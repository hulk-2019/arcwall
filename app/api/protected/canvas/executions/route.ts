import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getOwnedCanvas, listExecutionsByCanvas } from "@/models/canvas";

/**
 * 列出画布的执行记录（PRD-VID-004 后台运行）：
 * ?canvasId=&active=1 时仅返回进行中的执行，前端进入画布时据此恢复轮询。
 */
export async function GET(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const url = new URL(req.url);
    const canvasId = Number(url.searchParams.get("canvasId"));
    const onlyActive = url.searchParams.get("active") === "1";
    if (!Number.isFinite(canvasId) || canvasId <= 0) {
      return respErr(errMsg("invalid.params"));
    }

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const executions = await listExecutionsByCanvas(canvasId, onlyActive);
    return respData(executions);
  } catch (e) {
    console.error("list canvas executions failed:", e);
    return respErr(errMsg("canvas.execution.not.found"));
  }
}
