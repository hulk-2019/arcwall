import { prisma } from "@/lib/prisma";
import { resolveScope } from "./graph";
import { estimateNodeCost, NODE_TYPE_DEFS } from "./registry";
import type {
  CanvasNodeConfig,
  CanvasNodeType,
  EstimateDTO,
  EstimateItemDTO,
  ExecutionScope,
  ExecutionSnapshot,
  CanvasNodeOutput,
} from "@/types/canvas";

/**
 * 执行计划与不可变快照（技术方案 §七点一 编译流程 / §二点二 不可变快照）。
 * estimate 与 run 共用本模块，保证报价与实际执行范围一致。
 */

export type { ExecutionSnapshot };

export interface CanvasPlan {
  canvasId: number;
  baseRevision: number;
  scope: ExecutionScope;
  rootNodeId?: string;
  /** 不可变全图快照（含 text/upload 与范围外节点，用于执行期解析上游） */
  snapshot: ExecutionSnapshot;
  /** 执行范围内的全部节点（拓扑序，含 text/upload） */
  targetNodeIds: string[];
  /** 其中需要真正调用模型的节点（拓扑序） */
  executableIds: string[];
  items: EstimateItemDTO[];
  totalCredits: number;
}

export class PlanError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export async function loadCanvasGraph(canvasId: number) {
  // 同一事务批次内创建的行 created_at 相同，追加 id 作确定性次序键
  const [canvas, nodes, edges] = await Promise.all([
    prisma.canvases.findUnique({ where: { id: canvasId } }),
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
  return { canvas, nodes, edges };
}

/**
 * 编译执行计划：解析范围 → 全图快照 → 计价。
 * 抛出 PlanError（INVALID_GRAPH / MISSING_ROOT_NODE）。
 */
export async function buildCanvasPlan(
  canvasId: number,
  scope: ExecutionScope,
  rootNodeId?: string
): Promise<CanvasPlan> {
  const { canvas, nodes, edges } = await loadCanvasGraph(canvasId);
  if (!canvas) throw new PlanError("CANVAS_NOT_FOUND");

  const snapshot: ExecutionSnapshot = {
    revision: canvas.revision,
    scope,
    rootNodeId: rootNodeId ?? null,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as CanvasNodeType,
      revisionId: n.current_revision_id,
      config: ((n.current_revision?.config_json ?? {}) as CanvasNodeConfig),
    })),
    edges: edges.map((e) => ({
      sourceNodeId: e.source_node_id,
      targetNodeId: e.target_node_id,
      sourcePort: e.source_port,
      targetPort: e.target_port,
    })),
  };

  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));

  let targetIds: string[];
  try {
    targetIds = resolveScope(
      snapshot.nodes.map((n) => n.id),
      snapshot.edges,
      scope,
      rootNodeId
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "INVALID_GRAPH") throw new PlanError("INVALID_GRAPH");
    if (msg === "MISSING_ROOT_NODE") throw new PlanError("MISSING_ROOT_NODE");
    throw e;
  }

  const executableIds = targetIds.filter((id) => {
    const node = nodeById.get(id);
    return node ? NODE_TYPE_DEFS[node.type].executable : false;
  });

  const items: EstimateItemDTO[] = targetIds.map((id) => {
    const node = nodeById.get(id)!;
    return {
      nodeId: id,
      nodeType: node.type,
      title: typeof node.config.title === "string" ? node.config.title : undefined,
      model: typeof node.config.model === "string" ? node.config.model : undefined,
      credits: estimateNodeCost(node.type, node.config),
    };
  });
  const totalCredits = items.reduce((sum, it) => sum + it.credits, 0);

  return {
    canvasId,
    baseRevision: canvas.revision,
    scope,
    rootNodeId,
    snapshot,
    targetNodeIds: targetIds,
    executableIds,
    items,
    totalCredits,
  };
}

/**
 * 提交前预检：范围内节点引用了「范围外可执行上游」，但该上游在快照 revision 下
 * 没有成功输出（从未运行，或运行后配置被修改产生新 revision）。
 * 这类执行必然在 worker 阶段以 INPUT_NOT_READY 失败，提前拒绝以免先扣费再退款。
 */
export async function findUnreadyUpstreamRefs(
  plan: CanvasPlan
): Promise<{ id: string; title: string }[]> {
  const inScope = new Set(plan.targetNodeIds);
  const snapNodeById = new Map(plan.snapshot.nodes.map((n) => [n.id, n]));

  const upstreamIds = new Set<string>();
  for (const edge of plan.snapshot.edges) {
    if (!inScope.has(edge.targetNodeId) || inScope.has(edge.sourceNodeId)) continue;
    const source = snapNodeById.get(edge.sourceNodeId);
    if (source && NODE_TYPE_DEFS[source.type].executable) upstreamIds.add(source.id);
  }
  if (upstreamIds.size === 0) return [];

  const unready: { id: string; title: string }[] = [];
  for (const id of upstreamIds) {
    const source = snapNodeById.get(id)!;
    const ok = await prisma.step_runs.findFirst({
      where: { node_id: id, node_revision_id: source.revisionId ?? -1, status: "succeeded" },
      select: { id: true },
    });
    if (!ok) {
      const title =
        typeof source.config?.title === "string" && source.config.title ? source.config.title : id;
      unready.push({ id, title });
    }
  }
  return unready;
}

export function planToEstimateDTO(plan: CanvasPlan): EstimateDTO {
  return {
    canvasId: plan.canvasId,
    scope: plan.scope,
    rootNodeId: plan.rootNodeId,
    items: plan.items,
    totalCredits: plan.totalCredits,
    baseRevision: plan.baseRevision,
  };
}

// ---------------------------------------------------------------------------
// 快照上的被动节点输出推导（text / upload 不产生模型调用）
// ---------------------------------------------------------------------------

/**
 * text 节点输出：自身文本 + 上游 text 输出按连线顺序合并（PRD §八点一）。
 * 纯函数、带 memo、防环（图已在提交时校验为 DAG）。
 */
export function deriveTextOutput(
  snapshot: ExecutionSnapshot,
  nodeId: string,
  memo: Map<string, CanvasNodeOutput> = new Map()
): CanvasNodeOutput {
  const cached = memo.get(nodeId);
  if (cached) return cached;

  const node = snapshot.nodes.find((n) => n.id === nodeId);
  const config = node?.config ?? {};
  const chunks: string[] = [];
  for (const edge of snapshot.edges) {
    if (edge.targetNodeId !== nodeId || edge.targetPort !== "text") continue;
    const upstream = snapshot.nodes.find((n) => n.id === edge.sourceNodeId);
    if (!upstream || upstream.type !== "text") continue;
    const up = deriveTextOutput(snapshot, upstream.id, memo);
    if (up.text) chunks.push(up.text);
  }
  const own = typeof config.text === "string" ? config.text : "";
  const merged = [...chunks, own].filter((s) => s && s.trim().length > 0).join("\n\n");

  const output: CanvasNodeOutput = { kind: "text", text: merged };
  memo.set(nodeId, output);
  return output;
}

/**
 * upload 节点输出：config.storageKey 作为对应媒体类型的输出
 * （image / video / audio，按 config.mediaType 决定，参考图 / 首帧 / 参考音频来源）。
 */
export function deriveUploadOutput(snapshot: ExecutionSnapshot, nodeId: string): CanvasNodeOutput {
  const node = snapshot.nodes.find((n) => n.id === nodeId);
  const key = typeof node?.config.storageKey === "string" ? node.config.storageKey : "";
  const mediaType = node?.config.mediaType === "video" ? "video" : node?.config.mediaType === "audio" ? "audio" : "image";
  return { kind: mediaType, storageKeys: key ? [key] : [] };
}
