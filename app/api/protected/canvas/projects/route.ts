import { respData, createLocaleResp } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { requireAuthOrResponse } from "@/lib/auth";
import { findUserByEmail } from "@/models/user";
import { createProject, listProjects } from "@/models/canvas";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

export async function GET(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const projects = await listProjects(user.id);
    return respData(projects);
  } catch (e) {
    console.error("list canvas projects failed:", e);
    return respErr(errMsg("canvas.project.not.found"));
  }
}

export async function POST(req: Request) {
  const { respErr } = createLocaleResp(req);
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const parsed = CreateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return respErr(errMsg("invalid.params"));
    }

    const user = await findUserByEmail(auth.email);
    if (!user?.id) return respErr(errMsg("user.not.found"));

    const { project, canvas } = await createProject(
      user.id,
      parsed.data.name || "未命名画布"
    );

    return respData({
      id: project.id,
      name: project.name,
      canvasId: canvas.id,
    });
  } catch (e) {
    console.error("create canvas project failed:", e);
    return respErr(errMsg("canvas.create.project.failed"));
  }
}
