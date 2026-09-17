import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getOwnedCanvas } from "@/models/canvas";
import { buildCanvasPlan, planToEstimateDTO, PlanError, findUnreadyUpstreamRefs } from "@/lib/canvas/plan";
import type { ExecutionScope } from "@/types/canvas";
import { z } from "zod";

/**
 * 运行前估算（PRD-RUN-002 / 技术方案 §九点一 POST /executions/estimate）：
 * 校验执行范围并返回逐节点报价，不产生任何扣费或副作用。
 */

const EstimateSchema = z.object({
  canvasId: z.number().int(),
  scope: z.enum(["node", "downstream", "all"]),
  rootNodeId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = EstimateSchema.safeParse(body);
    if (!parsed.success) return respErr(errMsg("invalid.params"));

    const { canvasId, scope, rootNodeId } = parsed.data;

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const plan = await buildCanvasPlan(
      canvasId,
      scope as ExecutionScope,
      rootNodeId ?? undefined
    );

    if (plan.executableIds.length === 0) {
      return respErr(errMsg("canvas.no.executable.nodes"));
    }

    // 预检：范围外上游缺少与快照 revision 匹配的成功输出时提前拒绝（不产生扣费）
    const unready = await findUnreadyUpstreamRefs(plan);
    if (unready.length > 0) {
      const names = unready.map((u) => u.title).join("、");
      return respErr({
        zh: `上游节点「${names}」尚未运行或配置已变更，请先运行上游，或改用「运行下游」`,
        en: `Upstream node(s) "${unready.map((u) => u.title).join(", ")}" have no up-to-date output. Run them first, or use "Run downstream" instead`,
      });
    }

    return respData(planToEstimateDTO(plan));
  } catch (e) {
    if (e instanceof PlanError) {
      if (e.code === "INVALID_GRAPH") return respErr(errMsg("canvas.invalid.graph"));
      if (e.code === "MISSING_ROOT_NODE") return respErr(errMsg("invalid.params"));
    }
    console.error("estimate canvas failed:", e);
    return respErr(errMsg("canvas.estimate.failed"));
  }
}
