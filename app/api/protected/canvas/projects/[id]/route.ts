import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { getProject, renameProject, softDeleteProject } from "@/models/canvas";
import { z } from "zod";

const RenameSchema = z.object({
  name: z.string().min(1).max(255),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const projectId = Number(params.id);
    if (!Number.isFinite(projectId)) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const project = await getProject(user.id, projectId);
    if (!project) return respErr(errMsg("canvas.project.not.found"));

    const canvas = project.canvases[0];
    return respData({
      id: project.id,
      name: project.name,
      visibility: project.visibility,
      canvasId: canvas?.id ?? null,
      createdAt: project.created_at?.toISOString(),
      updatedAt: project.updated_at?.toISOString(),
    });
  } catch (e) {
    console.error("get canvas project failed:", e);
    return respErr(errMsg("canvas.project.not.found"));
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const projectId = Number(params.id);
    if (!Number.isFinite(projectId)) return respErr(errMsg("invalid.params"));

    const body = await req.json();
    const parsed = RenameSchema.safeParse(body);
    if (!parsed.success) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const ok = await renameProject(user.id, projectId, parsed.data.name);
    if (!ok) return respErr(errMsg("canvas.project.not.found"));

    return respData({ id: projectId, name: parsed.data.name });
  } catch (e) {
    console.error("rename canvas project failed:", e);
    return respErr(errMsg("canvas.save.failed"));
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const projectId = Number(params.id);
    if (!Number.isFinite(projectId)) return respErr(errMsg("invalid.params"));

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const ok = await softDeleteProject(user.id, projectId);
    if (!ok) return respErr(errMsg("canvas.project.not.found"));

    return respData({ id: projectId });
  } catch (e) {
    console.error("delete canvas project failed:", e);
    return respErr(errMsg("canvas.save.failed"));
  }
}
