import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { prisma } from "@/lib/prisma";
import { getExecution, requestCancelExecution } from "@/models/canvas";

/**
 * 请求取消执行（PRD-VID-005：取消等待与取消服务端任务分别表达）。
 * 已成功步骤保留结果照常结算，预扣差额在终态统一释放。
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const executionId = Number(params.id);
    if (!Number.isFinite(executionId)) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const execution = await prisma.executions.findUnique({
      where: { id: executionId },
      select: { user_id: true },
    });
    if (!execution) return respErr(errMsg("canvas.execution.not.found"));
    if (execution.user_id !== user.id) return respErr(errMsg("canvas.permission.denied"));

    const result = await requestCancelExecution(executionId);
    if (!result.ok) {
      if (result.status === "not_found") return respErr(errMsg("canvas.execution.not.found"));
      return respErr(errMsg("canvas.execution.not.active"));
    }

    return respData(await getExecution(executionId));
  } catch (e) {
    console.error("cancel canvas execution failed:", e);
    return respErr(errMsg("canvas.cancel.failed"));
  }
}
