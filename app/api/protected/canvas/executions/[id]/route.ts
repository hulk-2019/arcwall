import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { prisma } from "@/lib/prisma";
import { getExecution } from "@/models/canvas";

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    const result = await getExecution(executionId);
    return respData(result);
  } catch (e) {
    console.error("get canvas execution failed:", e);
    return respErr(errMsg("canvas.execution.not.found"));
  }
}
