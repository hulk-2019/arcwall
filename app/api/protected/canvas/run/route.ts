import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getUserBalance } from "@/services/credit";
import {
  createExecutionFromPlan,
  findExecutionByKey,
  getExecution,
  getOwnedCanvas,
} from "@/models/canvas";
import { buildCanvasPlan, PlanError, findUnreadyUpstreamRefs } from "@/lib/canvas/plan";
import { enqueueReadySteps } from "@/lib/canvas/orchestrator";
import type { ExecutionScope } from "@/types/canvas";
import { z } from "zod";

/**
 * 提交画布执行（技术方案 §九点二）：
 * 编译计划（不可变快照 + 报价）→ 同事务预扣 → 创建步骤 → 投递就绪步骤。
 * 幂等：同 user + idempotency_key 直接返回已有执行。
 */

const RunSchema = z.object({
  canvasId: z.number().int(),
  idempotencyKey: z.string().min(1).max(255),
  scope: z.enum(["node", "downstream", "all"]),
  rootNodeId: z.string().uuid().optional(),
});

function planErrorResponse(e: PlanError, respErr: (msg: any, status?: number) => Response) {
  if (e.code === "INVALID_GRAPH") return respErr(errMsg("canvas.invalid.graph"));
  if (e.code === "MISSING_ROOT_NODE") return respErr(errMsg("invalid.params"));
  return respErr(errMsg("canvas.run.failed"));
}

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = RunSchema.safeParse(body);
    if (!parsed.success) return respErr(errMsg("invalid.params"));

    const { canvasId, idempotencyKey, scope, rootNodeId } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    // 幂等：相同 idempotency_key 直接返回已有执行
    const existing = await findExecutionByKey(user.id, idempotencyKey);
    if (existing) {
      return respData(await getExecution(existing.id));
    }

    // 编译执行计划（范围解析 → 全图快照 → 计价）
    let plan;
    try {
      plan = await buildCanvasPlan(canvasId, scope as ExecutionScope, rootNodeId ?? undefined);
    } catch (e) {
      if (e instanceof PlanError) return planErrorResponse(e, respErr);
      throw e;
    }

    if (plan.executableIds.length === 0) {
      return respErr(errMsg("canvas.no.executable.nodes"));
    }

    // 预检：范围外上游缺少与快照 revision 匹配的成功输出时提前拒绝（不预扣）
    const unready = await findUnreadyUpstreamRefs(plan);
    if (unready.length > 0) {
      const names = unready.map((u) => u.title).join("、");
      return respErr({
        zh: `上游节点「${names}」尚未运行或配置已变更，请先运行上游，或改用「运行下游」`,
        en: `Upstream node(s) "${unready.map((u) => u.title).join(", ")}" have no up-to-date output. Run them first, or use "Run downstream" instead`,
      });
    }

    // 余额预检（事务内预扣仍会兜底，这里给出更友好的提前报错）
    const balance = await getUserBalance(user.id);
    if (balance < plan.totalCredits) {
      return respErr(errMsg("credits.not.enough"));
    }

    // 创建执行：同事务内预扣额度、保存快照、创建步骤
    let executionId: number;
    try {
      executionId = await createExecutionFromPlan({
        plan,
        userId: user.id,
        idempotencyKey,
      });
    } catch (e) {
      if (e instanceof Error && e.message === "insufficient.credits") {
        return respErr(errMsg("credits.not.enough"));
      }
      throw e;
    }

    // 投递已就绪的根步骤
    await enqueueReadySteps(executionId);

    const result = await getExecution(executionId);
    return respData(result);
  } catch (e) {
    console.error("run canvas failed:", e);
    return respErr(errMsg("canvas.run.failed"));
  }
}
