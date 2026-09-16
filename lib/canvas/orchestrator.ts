import { prisma } from "@/lib/prisma";
import { canvasQueue } from "@/lib/queue";
import type { ExecutionSnapshot } from "@/types/canvas";
import { finalizeExecutionIfDone } from "@/models/canvas";
import type { ExecutionStatus } from "@/types/canvas";

/**
 * 执行编排（技术方案 §七点一）：基于不可变快照解锁下游步骤，
 * 失败只跳过受影响的传递下游（独立分支继续执行），全部终态后汇总。
 * 所有状态迁移均使用 CAS（updateMany 带状态条件），保证消息重复投递时幂等。
 */

const TERMINAL_STEP_STATUSES = ["succeeded", "failed", "cancelled", "skipped"];
export const ACTIVE_EXECUTION_STATUSES = ["queued", "running", "cancel_requested"];

/** poller 租约时长：认领后其他扫描周期不会再认领同一条 */
export const POLL_LEASE_MS = 60_000;
/** 供应商任务平台超时（技术方案 §十三 风险：视频任务长时间无终态） */
export const PROVIDER_JOB_TIMEOUT_MS = 15 * 60_000;
/** 轮询退避：3s → 6s → 12s → 20s 封顶 */
export function pollBackoffMs(pollCount: number): number {
  return Math.min(20_000, 3000 * 2 ** Math.max(0, pollCount));
}

function parseSnapshot(raw: unknown): ExecutionSnapshot | null {
  if (!raw) return null;
  const snap = raw as ExecutionSnapshot;
  if (!Array.isArray(snap.nodes) || !Array.isArray(snap.edges)) return null;
  return snap;
}

/**
 * 把「已就绪」的步骤投入队列：快照内全部上游步骤均 succeeded。
 * 每个步骤 pending → queued 走 CAS，重复调用不会重复投递。
 */
export async function enqueueReadySteps(executionId: number) {
  const execution = await prisma.executions.findUnique({
    where: { id: executionId },
    include: { step_runs: true },
  });
  if (!execution) return;
  if (execution.status === "cancel_requested") {
    await finalizeExecutionIfDone(executionId);
    return;
  }

  const snapshot = parseSnapshot(execution.snapshot_json);
  if (!snapshot) {
    // 无有效快照：直接失败整个执行，避免不可复现地执行
    await prisma.executions.updateMany({
      where: { id: executionId, status: { in: ACTIVE_EXECUTION_STATUSES } },
      data: { status: "failed", error_code: "INVALID_GRAPH", updated_at: new Date() },
    });
    return;
  }

  const stepRuns = execution.step_runs;
  const nodeIds = new Set(stepRuns.map((s) => s.node_id));
  const statusByNode = new Map(stepRuns.map((s) => [s.node_id, s.status]));

  // 依赖只看「本执行内」的上游；范围外上游在步骤执行时按快照解析历史输出
  const predecessors = new Map<string, string[]>();
  for (const e of snapshot.edges) {
    if (nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId)) {
      const list = predecessors.get(e.targetNodeId) || [];
      list.push(e.sourceNodeId);
      predecessors.set(e.targetNodeId, list);
    }
  }

  let enqueued = 0;
  for (const s of stepRuns) {
    if (s.status !== "pending") continue;
    const preds = predecessors.get(s.node_id) || [];
    const allUpstreamDone = preds.every((p) => statusByNode.get(p) === "succeeded");
    if (!allUpstreamDone) continue;

    const claimed = await prisma.step_runs.updateMany({
      where: { id: s.id, status: "pending" },
      data: { status: "queued", updated_at: new Date() },
    });
    if (claimed.count === 0) continue;

    await canvasQueue.add("execute-step", {
      stepRunId: s.id,
      executionId,
      nodeId: s.node_id,
    });
    enqueued += 1;
  }

  if (enqueued > 0 && execution.status === "queued") {
    await prisma.executions.updateMany({
      where: { id: executionId, status: "queued" },
      data: { status: "running", updated_at: new Date() },
    });
  }

  await finalizeExecutionIfDone(executionId);
}

/**
 * 步骤失败后跳过其（快照内的）传递下游；独立分支继续执行。
 */
export async function skipDownstreamSteps(executionId: number, failedNodeId: string) {
  const execution = await prisma.executions.findUnique({
    where: { id: executionId },
    include: { step_runs: true },
  });
  if (!execution) return;
  const snapshot = parseSnapshot(execution.snapshot_json);
  if (!snapshot) return;

  const visited = new Set<string>([failedNodeId]);
  const stack = [failedNodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const e of snapshot.edges) {
      if (e.sourceNodeId !== current) continue;
      if (!visited.has(e.targetNodeId)) {
        visited.add(e.targetNodeId);
        stack.push(e.targetNodeId);
      }
    }
  }
  visited.delete(failedNodeId);
  if (visited.size === 0) return;

  await prisma.step_runs.updateMany({
    where: {
      execution_id: executionId,
      node_id: { in: [...visited] },
      status: { in: ["pending", "queued"] },
    },
    data: { status: "skipped", updated_at: new Date() },
  });
}

/**
 * 汇总执行终态并结算（详细规则见 models/canvas.ts finalizeExecutionIfDone）。
 */
export { finalizeExecutionIfDone };

/**
 * poller 扫描器认领到期任务：next_poll_at CAS 前推一个租约窗口。
 */
export async function claimDueProviderJobs(limit = 10): Promise<number[]> {
  const now = new Date();
  const due = await prisma.provider_jobs.findMany({
    where: {
      status: { in: ["submitting", "running"] },
      next_poll_at: { lte: now },
    },
    take: limit,
    orderBy: { next_poll_at: "asc" },
  });

  const claimedIds: number[] = [];
  for (const job of due) {
    const claimed = await prisma.provider_jobs.updateMany({
      where: { id: job.id, next_poll_at: job.next_poll_at, status: job.status },
      data: { next_poll_at: new Date(now.getTime() + POLL_LEASE_MS), updated_at: now },
    });
    if (claimed.count === 1) claimedIds.push(job.id);
  }
  return claimedIds;
}

/**
 * Worker 启动恢复（技术方案 §十四点三）：
 * - 卡在 running 的同步步骤（无活跃供应商任务）→ 回到 queued 重新投递；
 * - 卡在 queued 的步骤（消息丢失）→ 重新投递；
 * - submitting 且已拿到 external_id 的供应商任务 → 转为 running 等待轮询；
 * - 活跃执行统一走一次 enqueueReadySteps 兜底。
 */
export async function recoverInterruptedWork() {
  const activeExecutions = await prisma.executions.findMany({
    where: { status: { in: ACTIVE_EXECUTION_STATUSES } },
    include: { step_runs: { include: { provider_jobs: true } } },
  });

  for (const execution of activeExecutions) {
    for (const step of execution.step_runs) {
      // submitting 且已拿到 external_id：提交已发生，转 running 交给 poller
      for (const job of step.provider_jobs) {
        if (job.status === "submitting" && job.external_id) {
          await prisma.provider_jobs.updateMany({
            where: { id: job.id, status: "submitting" },
            data: { status: "running", next_poll_at: new Date(), updated_at: new Date() },
          });
        }
      }

      const hasActiveProviderJob = step.provider_jobs.some((p) =>
        ["submitting", "running"].includes(p.status)
      );

      if (step.status === "running" && !hasActiveProviderJob) {
        const reset = await prisma.step_runs.updateMany({
          where: { id: step.id, status: "running" },
          data: { status: "queued", updated_at: new Date() },
        });
        if (reset.count === 1) {
          await canvasQueue.add("execute-step", {
            stepRunId: step.id,
            executionId: execution.id,
            nodeId: step.node_id,
          });
        }
      } else if (step.status === "queued") {
        await canvasQueue.add("execute-step", {
          stepRunId: step.id,
          executionId: execution.id,
          nodeId: step.node_id,
        });
      }
    }

    await enqueueReadySteps(execution.id);
  }
}

export type { ExecutionStatus };
