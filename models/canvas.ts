import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import { TransactionType } from "@prisma/client";
import { getSignedUrl } from "@/lib/oss";
import { adjustUserCreditsInTx } from "@/services/credit";
import { cancelVideoTask } from "@/services/video";
import type {
  CanvasEdgeDTO,
  CanvasNodeConfig,
  CanvasNodeDTO,
  CanvasNodeOutput,
  CanvasNodeType,
  CanvasOperation,
  ExecutionDTO,
  ExecutionScope,
  ExecutionSnapshot,
  ExecutionStatus,
  StepRunDTO,
  StepStatus,
} from "@/types/canvas";
import {
  deriveTextOutput,
  deriveUploadOutput,
  type CanvasPlan,
} from "@/lib/canvas/plan";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";

/** 展示用签名 URL 的有效期（秒）。事实源始终是 storageKeys，URL 不落库。 */
export const SIGNED_URL_TTL = 3600;

export const ACTIVE_EXECUTION_STATUSES = ["queued", "running", "cancel_requested"];
const TERMINAL_STEP_STATUSES = ["succeeded", "failed", "cancelled", "skipped"];

export function hashConfig(config: CanvasNodeConfig): string {
  return createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 64);
}

/** 读取时为输出动态生成签名 URL（技术方案 §十一点二：不保存永久 URL）。单个签名失败不影响整体。 */
export async function signOutputUrls(output: CanvasNodeOutput): Promise<CanvasNodeOutput> {
  if (!output.storageKeys || output.storageKeys.length === 0) return output;
  const urls = await Promise.all(
    output.storageKeys.map(async (key) => {
      try {
        return await getSignedUrl(key, SIGNED_URL_TTL);
      } catch (e) {
        console.error(`sign url failed for ${key}:`, e);
        return "";
      }
    })
  );
  return { ...output, urls: urls.filter(Boolean) };
}

// ---------------------------------------------------------------------------
// Projects & Canvases
// ---------------------------------------------------------------------------

export async function createProject(userId: number, name: string) {
  const project = await prisma.projects.create({
    data: {
      user_id: userId,
      name: name || "未命名画布",
      visibility: "private",
    },
  });
  const canvas = await prisma.canvases.create({
    data: {
      project_id: project.id,
      revision: 1,
      viewport_json: { x: 0, y: 0, scale: 1 },
    },
  });
  return { project, canvas };
}

export async function listProjects(userId: number) {
  const projects = await prisma.projects.findMany({
    where: { user_id: userId, is_deleted: false },
    orderBy: { updated_at: "desc" },
    include: { canvases: { select: { id: true } } },
  });

  const rows = await Promise.all(
    projects.map(async (p) => {
      const canvasId = p.canvases[0]?.id ?? null;
      let nodeCount = 0;
      let coverUrl: string | null = null;
      if (canvasId) {
        nodeCount = await prisma.nodes.count({ where: { canvas_id: canvasId } });
      }
      if (p.cover_asset_id) {
        const asset = await prisma.canvas_assets.findUnique({
          where: { id: p.cover_asset_id },
        });
        if (asset) coverUrl = asset.storage_key;
      }
      return {
        id: p.id,
        name: p.name,
        canvasId,
        nodeCount,
        coverUrl,
        updatedAt: p.updated_at?.toISOString(),
        createdAt: p.created_at?.toISOString(),
      };
    })
  );
  return rows;
}

export async function getProject(userId: number, projectId: number) {
  const project = await prisma.projects.findFirst({
    where: { id: projectId, user_id: userId, is_deleted: false },
    include: { canvases: true },
  });
  if (!project) return null;
  return project;
}

export async function renameProject(userId: number, projectId: number, name: string) {
  const res = await prisma.projects.updateMany({
    where: { id: projectId, user_id: userId, is_deleted: false },
    data: { name, updated_at: new Date() },
  });
  return res.count > 0;
}

export async function softDeleteProject(userId: number, projectId: number) {
  const res = await prisma.projects.updateMany({
    where: { id: projectId, user_id: userId, is_deleted: false },
    data: { is_deleted: true, deleted_at: new Date(), updated_at: new Date() },
  });
  return res.count > 0;
}

// ---------------------------------------------------------------------------
// Nodes / Revisions / Edges
// ---------------------------------------------------------------------------

export async function getCanvasGraph(canvasId: number) {
  // 同一事务批次内创建的行 created_at 相同，追加 id 作确定性次序键
  const [nodes, edges] = await Promise.all([
    prisma.nodes.findMany({
      where: { canvas_id: canvasId },
      include: { current_revision: true },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    }),
    prisma.edges.findMany({
      where: { canvas_id: canvasId },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
    }),
  ]);
  return { nodes, edges };
}

/** 校验画布属主（project.user_id），返回画布行或 null。 */
export async function getOwnedCanvas(userId: number, canvasId: number) {
  const canvas = await prisma.canvases.findUnique({
    where: { id: canvasId },
    include: { project: { select: { user_id: true } } },
  });
  if (!canvas || canvas.project.user_id !== userId) return null;
  return canvas;
}

function toEdgeDTO(row: any): CanvasEdgeDTO {
  return {
    id: row.id,
    sourceNodeId: row.source_node_id,
    sourcePort: row.source_port,
    targetNodeId: row.target_node_id,
    targetPort: row.target_port,
  };
}

/**
 * 获取每个节点的最新一次 step_run（跨执行）。
 */
async function latestStepRuns(canvasId: number) {
  const nodeIds = await prisma.nodes.findMany({
    where: { canvas_id: canvasId },
    select: { id: true },
  });
  const ids = nodeIds.map((n) => n.id);
  if (ids.length === 0)
    return new Map<string, {
      status: string;
      output: CanvasNodeOutput | null;
      error?: string;
      revisionId: number | null;
    }>();

  const runs = await prisma.step_runs.findMany({
    where: { node_id: { in: ids } },
    orderBy: { id: "desc" },
  });
  const latestByNode = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    if (!latestByNode.has(r.node_id)) latestByNode.set(r.node_id, r);
  }

  const map = new Map<string, {
    status: string;
    output: CanvasNodeOutput | null;
    error?: string;
    revisionId: number | null;
  }>();
  for (const [nodeId, r] of latestByNode) {
    map.set(nodeId, {
      status: r.status,
      output: (r.output_json ?? null) as CanvasNodeOutput | null,
      error: r.error_message ?? undefined,
      revisionId: r.node_revision_id,
    });
  }
  return map;
}

/**
 * 画布快照：节点状态/输出来自最近一次 step_run；text/upload 节点由当前配置推导；
*  输出的 URL 动态签名，不依赖落库的过期链接。
 */
export async function getCanvasSnapshot(canvasId: number) {
  const [{ nodes, edges }, canvas, runMap] = await Promise.all([
    getCanvasGraph(canvasId),
    prisma.canvases.findUnique({ where: { id: canvasId } }),
    latestStepRuns(canvasId),
  ]);

  // 为 text/upload 的推导构建最小快照结构
  const derivationSnapshot: ExecutionSnapshot = {
    revision: canvas?.revision ?? 1,
    scope: "all",
    rootNodeId: null,
    nodes: nodes.map((n: any) => ({
      id: n.id,
      type: n.type as CanvasNodeType,
      revisionId: n.current_revision_id,
      config: (n.current_revision?.config_json ?? {}) as CanvasNodeConfig,
    })),
    edges: edges.map((e: any) => ({
      sourceNodeId: e.source_node_id,
      targetNodeId: e.target_node_id,
      sourcePort: e.source_port,
      targetPort: e.target_port,
    })),
  };
  const textMemo = new Map<string, CanvasNodeOutput>();

  const nodeDTOs = await Promise.all(
    nodes.map(async (n: any) => {
      const config = (n.current_revision?.config_json ?? {}) as CanvasNodeConfig;
      const run = runMap.get(n.id);
      let output = run?.output ?? undefined;
      const status = (run?.status as StepStatus) ?? "idle";

      if (n.type === "text") {
        output = deriveTextOutput(derivationSnapshot, n.id, textMemo);
      } else if (n.type === "upload") {
        output = deriveUploadOutput(derivationSnapshot, n.id);
      }
      if (output) output = await signOutputUrls(output);

      // 产物过期：最近一次执行后配置又被修改（revision 不一致）。
      // text/upload 为运行时推导，不存在过期概念。
      const outputStale =
        n.type !== "text" && n.type !== "upload"
          ? run != null && run.revisionId !== n.current_revision_id
          : false;

      return {
        id: n.id,
        type: n.type as CanvasNodeType,
        x: n.x,
        y: n.y,
        revisionId: n.current_revision_id ?? undefined,
        config,
        status,
        output,
        outputStale,
        error: run?.error,
      } satisfies CanvasNodeDTO;
    })
  );

  return {
    canvasId,
    projectId: canvas?.project_id ?? 0,
    revision: canvas?.revision ?? 1,
    nodes: nodeDTOs,
    edges: edges.map(toEdgeDTO),
  };
}

/**
 * 应用一批画布操作（自动保存）。操作在单个事务中执行，成功后 revision + 1。
 * 节点/边主键为客户端生成的 UUID：upsert 按该 id 幂等执行，重放安全，
 * 且无需向客户端回传任何 id 映射。返回新的 revision。
 */
export async function applyOperations(
  canvasId: number,
  operations: CanvasOperation[]
): Promise<{ revision: number }> {
  await prisma.$transaction(async (tx) => {
    for (const op of operations) {
      switch (op.op) {
        case "node.upsert": {
          // 必须限定 canvas_id：防止用他人画布的节点 id 越权更新
          const existing = await tx.nodes.findFirst({
            where: { id: op.nodeId, canvas_id: canvasId },
            include: { current_revision: true },
          });
          if (!existing) {
            const node = await tx.nodes.create({
              data: { id: op.nodeId, canvas_id: canvasId, type: op.type, x: op.x, y: op.y },
            });
            const rev = await tx.node_revisions.create({
              data: {
                node_id: node.id,
                config_json: op.config as any,
                content_hash: hashConfig(op.config),
              },
            });
            await tx.nodes.update({
              where: { id: node.id },
              data: { current_revision_id: rev.id },
            });
          } else {
            const currentConfig = (existing.current_revision?.config_json ?? {}) as CanvasNodeConfig;
            const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(op.config);
            let revId = existing.current_revision_id;
            if (configChanged) {
              const rev = await tx.node_revisions.create({
                data: {
                  node_id: existing.id,
                  config_json: op.config as any,
                  content_hash: hashConfig(op.config),
                },
              });
              revId = rev.id;
            }
            await tx.nodes.update({
              where: { id: existing.id },
              data: { type: op.type, x: op.x, y: op.y, current_revision_id: revId, updated_at: new Date() },
            });
          }
          break;
        }
        case "node.move": {
          await tx.nodes.updateMany({
            where: { id: op.nodeId, canvas_id: canvasId },
            data: { x: op.x, y: op.y, updated_at: new Date() },
          });
          break;
        }
        case "node.config": {
          const existing = await tx.nodes.findFirst({
            where: { id: op.nodeId, canvas_id: canvasId },
            include: { current_revision: true },
          });
          if (!existing) break;
          const rev = await tx.node_revisions.create({
            data: {
              node_id: existing.id,
              config_json: op.config as any,
              content_hash: hashConfig(op.config),
            },
          });
          await tx.nodes.update({
            where: { id: existing.id },
            data: { current_revision_id: rev.id, updated_at: new Date() },
          });
          break;
        }
        case "node.delete": {
          await tx.edges.deleteMany({
            where: {
              canvas_id: canvasId,
              OR: [{ source_node_id: op.nodeId }, { target_node_id: op.nodeId }],
            },
          });
          await tx.nodes.deleteMany({ where: { id: op.nodeId, canvas_id: canvasId } });
          break;
        }
        case "edge.add": {
          // 限定 canvas_id 的幂等 upsert：id 属于其他画布时不允许更新
          const existingEdge = await tx.edges.findFirst({
            where: { id: op.edgeId, canvas_id: canvasId },
            select: { id: true },
          });
          if (!existingEdge) {
            await tx.edges.create({
              data: {
                id: op.edgeId,
                canvas_id: canvasId,
                source_node_id: op.sourceNodeId,
                target_node_id: op.targetNodeId,
                source_port: "output",
                target_port: op.targetPort,
              },
            });
          } else {
            await tx.edges.updateMany({
              where: { id: op.edgeId, canvas_id: canvasId },
              data: {
                source_node_id: op.sourceNodeId,
                target_node_id: op.targetNodeId,
                source_port: "output",
                target_port: op.targetPort,
              },
            });
          }
          break;
        }
        case "edge.delete": {
          await tx.edges.deleteMany({ where: { id: op.edgeId, canvas_id: canvasId } });
          break;
        }
        case "viewport": {
          await tx.canvases.update({
            where: { id: canvasId },
            data: { viewport_json: op.viewport as any },
          });
          break;
        }
      }
    }

    await tx.canvases.update({
      where: { id: canvasId },
      data: { revision: { increment: 1 }, updated_at: new Date() },
    });
  });

  const canvas = await prisma.canvases.findUnique({
    where: { id: canvasId },
    select: { revision: true },
  });
  return { revision: canvas?.revision ?? 1 };
}

// ---------------------------------------------------------------------------
// Executions & Step Runs
// ---------------------------------------------------------------------------

export async function findExecutionByKey(userId: number, idempotencyKey: string) {
  return prisma.executions.findUnique({
    where: { user_id_idempotency_key: { user_id: userId, idempotency_key: idempotencyKey } },
    include: { step_runs: { orderBy: { id: "asc" } } },
  });
}

/**
 * 创建执行（技术方案 §七点一 编译流程第 5 步）：
 * 同一事务内预扣额度、保存不可变快照、创建步骤。
 * text/upload 等被动节点直接写为 succeeded（输出由快照配置推导），下游解锁逻辑统一。
 */
export async function createExecutionFromPlan(input: {
  plan: CanvasPlan;
  userId: number;
  idempotencyKey: string;
}): Promise<number> {
  const { plan, userId, idempotencyKey } = input;
  const textMemo = new Map<string, CanvasNodeOutput>();

  return prisma.$transaction(
    async (tx) => {
      const execution = await tx.executions.create({
        data: {
          canvas_id: plan.canvasId,
          user_id: userId,
          idempotency_key: idempotencyKey,
          scope: plan.scope,
          root_node_id: plan.rootNodeId ?? null,
          snapshot_json: plan.snapshot as any,
          reserved_credits: plan.totalCredits,
          status: "queued",
        },
      });

      // 预扣（余额不足抛 insufficient.credits，整体回滚）
      if (plan.totalCredits > 0) {
        await adjustUserCreditsInTx(
          tx,
          userId,
          -plan.totalCredits,
          TransactionType.consume,
          `画布执行预扣 (execution ${execution.id})`
        );
      }

      const executableSet = new Set(plan.executableIds);
      for (const nodeId of plan.targetNodeIds) {
        const snapshotNode = plan.snapshot.nodes.find((n) => n.id === nodeId)!;
        if (executableSet.has(nodeId)) {
          await tx.step_runs.create({
            data: {
              execution_id: execution.id,
              node_id: nodeId,
              node_revision_id: snapshotNode.revisionId!,
              status: "pending",
            },
          });
        } else {
          // 被动节点（text/upload）：建执行即完成，成本 0
          const output =
            snapshotNode.type === "text"
              ? deriveTextOutput(plan.snapshot, nodeId, textMemo)
              : deriveUploadOutput(plan.snapshot, nodeId);
          await tx.step_runs.create({
            data: {
              execution_id: execution.id,
              node_id: nodeId,
              node_revision_id: snapshotNode.revisionId!,
              status: "succeeded",
              output_json: output as any,
              credits_consumed: 0,
            },
          });
        }
      }

      return execution.id;
    },
    { maxWait: 10000, timeout: 30000 }
  );
}

function toStepRunDTO(r: any): StepRunDTO {
  return {
    id: r.id,
    executionId: r.execution_id,
    nodeId: r.node_id,
    status: r.status as StepStatus,
    output: (r.output_json ?? undefined) as CanvasNodeOutput | undefined,
    errorCode: r.error_code ?? undefined,
    errorMessage: r.error_message ?? undefined,
    creditsConsumed: r.credits_consumed ?? 0,
  };
}

function toExecutionDTO(e: any): ExecutionDTO {
  return {
    id: e.id,
    canvasId: e.canvas_id,
    scope: e.scope as ExecutionScope,
    rootNodeId: e.root_node_id ?? undefined,
    status: e.status as ExecutionStatus,
    reservedCredits: e.reserved_credits,
    capturedCredits: e.captured_credits ?? 0,
    errorCode: e.error_code ?? undefined,
    stepRuns: (e.step_runs || []).map(toStepRunDTO),
    createdAt: e.created_at?.toISOString(),
    updatedAt: e.updated_at?.toISOString(),
  };
}

/** 读取执行详情：输出 URL 动态签名。 */
export async function getExecution(executionId: number) {
  const e = await prisma.executions.findUnique({
    where: { id: executionId },
    include: { step_runs: { orderBy: { id: "asc" } } },
  });
  if (!e) return null;
  const dto = toExecutionDTO(e);
  const stepRuns = await Promise.all(
    dto.stepRuns.map(async (s) => (s.output ? { ...s, output: await signOutputUrls(s.output) } : s))
  );
  return { ...dto, stepRuns };
}

/** 列出画布的执行记录（用于前端恢复后台运行中的任务）。 */
export async function listExecutionsByCanvas(canvasId: number, onlyActive: boolean) {
  const executions = await prisma.executions.findMany({
    where: onlyActive
      ? { canvas_id: canvasId, status: { in: ACTIVE_EXECUTION_STATUSES } }
      : { canvas_id: canvasId },
    orderBy: { id: "desc" },
    take: 20,
    include: { step_runs: { orderBy: { id: "asc" } } },
  });
  const dtos = executions.map(toExecutionDTO);
  return Promise.all(
    dtos.map(async (dto) => ({
      ...dto,
      stepRuns: await Promise.all(
        dto.stepRuns.map(async (s) =>
          s.output ? { ...s, output: await signOutputUrls(s.output) } : s
        )
      ),
    }))
  );
}

/**
 * 完成步骤并结算成本。仅 running 步骤可以提交结果：
 * 若取消已先把步骤置为 cancelled，则丢弃稍后返回的供应商结果，避免取消被覆盖。
 */
export async function completeStepRun(
  stepRunId: number,
  output: CanvasNodeOutput,
  creditsConsumed: number
) {
  const stepRun = await prisma.step_runs.findUnique({
    where: { id: stepRunId },
    select: { execution_id: true },
  });
  if (!stepRun) return;

  await prisma.$transaction(
    async (tx) => {
      const execution = await tx.executions.findUnique({
        where: { id: stepRun.execution_id },
        select: { status: true, user_id: true },
      });
      if (!execution || !ACTIVE_EXECUTION_STATUSES.includes(execution.status)) return;

      const completed = await tx.step_runs.updateMany({
        where: { id: stepRunId, status: "running" },
        data: {
          status: "succeeded",
          output_json: output as any,
          credits_consumed: creditsConsumed,
          updated_at: new Date(),
        },
      });
      if (completed.count === 0) return;
    },
    { maxWait: 10000, timeout: 30000 }
  );
}

export async function failStepRun(stepRunId: number, errorCode: string, errorMessage: string) {
  await prisma.step_runs.updateMany({
    where: { id: stepRunId, status: "running" },
    data: {
      status: "failed",
      error_code: errorCode,
      error_message: errorMessage,
      updated_at: new Date(),
    },
  });
}

/**
 * 汇总执行状态并在全部步骤终态后结算（技术方案 §十二点一）：
 * captured = 成功步骤实耗之和；预扣差额释放（refund）。CAS 保证幂等。
 */
export async function finalizeExecutionIfDone(executionId: number): Promise<void> {
  const e = await prisma.executions.findUnique({
    where: { id: executionId },
    include: { step_runs: true },
  });
  if (!e) return;
  if (!ACTIVE_EXECUTION_STATUSES.includes(e.status)) return;
  if (e.step_runs.some((s) => !TERMINAL_STEP_STATUSES.includes(s.status))) return;

  let status: ExecutionStatus;
  if (e.step_runs.some((s) => s.status === "cancelled")) {
    status = "cancelled";
  } else if (e.step_runs.every((s) => s.status === "succeeded")) {
    status = "succeeded";
  } else if (e.step_runs.some((s) => s.status === "succeeded")) {
    status = "partially_succeeded";
  } else {
    status = "failed";
  }

  const captured = e.step_runs
    .filter((s) => s.status === "succeeded")
    .reduce((sum, s) => sum + s.credits_consumed, 0);

  await prisma.$transaction(
    async (tx) => {
      // CAS：仅一个调用方能从活跃态写入终态，重复调用直接跳过
      const winner = await tx.executions.updateMany({
        where: { id: executionId, status: { in: ACTIVE_EXECUTION_STATUSES } },
        data: { status, captured_credits: captured, updated_at: new Date() },
      });
      if (winner.count === 0) return;

      const release = e.reserved_credits - captured;
      if (release > 0) {
        await adjustUserCreditsInTx(
          tx,
          e.user_id,
          release,
          TransactionType.refund,
          `画布执行释放 (execution ${executionId})`
        );
      }
    },
    { maxWait: 10000, timeout: 30000 }
  );
}

/**
 * 请求取消执行（PRD-VID-005）：所有未完成步骤直接取消，
 * 运行中的供应商任务尽力取消；已成功步骤保留结果照常结算。
 */
export async function requestCancelExecution(executionId: number): Promise<{
  ok: boolean;
  status: string;
}> {
  const e = await prisma.executions.findUnique({
    where: { id: executionId },
    include: { step_runs: { include: { provider_jobs: true } } },
  });
  if (!e) return { ok: false, status: "not_found" };
  if (!ACTIVE_EXECUTION_STATUSES.includes(e.status)) return { ok: false, status: e.status };

  await prisma.executions.updateMany({
    where: { id: executionId, status: { in: ACTIVE_EXECUTION_STATUSES } },
    data: { status: "cancel_requested", updated_at: new Date() },
  });
  await prisma.step_runs.updateMany({
    where: { execution_id: executionId, status: { in: ["pending", "queued", "running"] } },
    data: { status: "cancelled", updated_at: new Date() },
  });

  for (const s of e.step_runs) {
    const job = s.provider_jobs.find((p) => ["submitting", "running"].includes(p.status));
    if (!job) continue;
    if (job.external_id) {
      await cancelVideoTask(job.external_id).catch(() => false);
    }
    await prisma.provider_jobs.update({
      where: { id: job.id },
      data: { status: "cancelled", updated_at: new Date() },
    });
    await prisma.step_runs.updateMany({
      where: { id: s.id, status: "running" },
      data: { status: "cancelled", updated_at: new Date() },
    });
  }

  await finalizeExecutionIfDone(executionId);

  const after = await prisma.executions.findUnique({ where: { id: executionId } });
  return { ok: true, status: after?.status ?? "cancelled" };
}

// ---------------------------------------------------------------------------
// Assets（上传素材，PRD-AST-001）
// ---------------------------------------------------------------------------

export async function createCanvasAsset(input: {
  userId: number;
  mediaType: string;
  storageKey: string;
  sha256?: string;
}) {
  return prisma.canvas_assets.create({
    data: {
      user_id: input.userId,
      media_type: input.mediaType,
      storage_key: input.storageKey,
      sha256: input.sha256,
      status: "ready",
    },
  });
}

export { NODE_TYPE_DEFS };
