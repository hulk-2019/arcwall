import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getOwnedCanvas } from "@/models/canvas";
import { buildCanvasPlan, planToEstimateDTO, PlanError } from "@/lib/canvas/plan";
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
