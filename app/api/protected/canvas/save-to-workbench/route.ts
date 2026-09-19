import { NextRequest } from "next/server";
import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getOwnedCanvas } from "@/models/canvas";
import {
  CanvasWorkbenchError,
  saveCanvasMediaToWorkbench,
} from "@/services/canvas-workbench";

export async function POST(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const body = await req.json();
    const canvasId = Number(body?.canvasId);
    const nodeId = typeof body?.nodeId === "string" ? body.nodeId.trim() : "";
    if (!Number.isInteger(canvasId) || canvasId <= 0 || !nodeId) {
      return respErr(errMsg("invalid.params"));
    }

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const result = await saveCanvasMediaToWorkbench({
      userId: user.id,
      canvasId,
      nodeId,
    });
    return respData(result);
  } catch (error) {
    if (error instanceof CanvasWorkbenchError) {
      if (error.code === "no_media") return respErr(errMsg("canvas.workbench.no.media"));
      return respErr(errMsg("canvas.workbench.unsupported.node"));
    }
    console.error("save canvas media to workbench failed:", error);
    return respErr(errMsg("canvas.workbench.save.failed"));
  }
}
