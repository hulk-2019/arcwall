import { NextRequest } from "next/server";
import { requireAuthOrResponse } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { createLocaleResp, respData } from "@/lib/resp";
import { errMsg } from "@/messages/errors";
import { getOwnedCanvas } from "@/models/canvas";
import { findUserByEmail } from "@/models/user";
import { fetchSunoLyrics, submitSunoLyrics } from "@/services/suno-proxy";

const LYRICS_TASK_TTL_SECONDS = 15 * 60;

function lyricsTaskOwnerKey(taskId: string): string {
  return `canvas:lyrics-task:${taskId}`;
}

async function authenticatedUser(req: NextRequest) {
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;
  const user = await findUserByEmail(auth.email);
  return user?.id ? { id: user.id } : null;
}

/** 提交 Suno 歌词生成任务。 */
export async function POST(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  const user = await authenticatedUser(req);
  if (user instanceof Response) return user;
  if (!user) return respErr(errMsg("user.not.found"));

  try {
    const body = await req.json();
    const canvasId = Number(body?.canvasId);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!canvasId || !prompt) return respErr(errMsg("invalid.params"));
    if (prompt.length > 200) return respErr(errMsg("canvas.lyrics.too.long"));

    const canvas = await getOwnedCanvas(user.id, canvasId);
    if (!canvas) return respErr(errMsg("canvas.permission.denied"));

    const taskId = await submitSunoLyrics(prompt);
    await redis.set(
      lyricsTaskOwnerKey(taskId),
      String(user.id),
      "EX",
      LYRICS_TASK_TTL_SECONDS
    );
    return respData({ taskId });
  } catch (error) {
    console.error("submit Suno lyrics failed:", error);
    return respErr(errMsg("canvas.lyrics.failed"));
  }
}

/** 查询当前用户提交的 Suno 歌词任务。 */
export async function GET(req: NextRequest) {
  const { respErr } = createLocaleResp(req);
  const user = await authenticatedUser(req);
  if (user instanceof Response) return user;
  if (!user) return respErr(errMsg("user.not.found"));

  try {
    const taskId = req.nextUrl.searchParams.get("taskId")?.trim() ?? "";
    if (!taskId) return respErr(errMsg("invalid.params"));

    const ownerId = await redis.get(lyricsTaskOwnerKey(taskId));
    if (ownerId !== String(user.id)) {
      return respErr(errMsg("canvas.permission.denied"));
    }

    return respData(await fetchSunoLyrics(taskId));
  } catch (error) {
    console.error("fetch Suno lyrics failed:", error);
    return respErr(errMsg("canvas.lyrics.failed"));
  }
}
