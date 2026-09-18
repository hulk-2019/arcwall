import axios from "axios";
import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { requireAuthOrResponse } from "@/lib/auth";
import { safeSongFilename, type TimedLyricWord } from "@/lib/audio-lyrics";
import {
  getSignedDownloadUrl,
  getSignedInternalUrl,
  internalDownloadHeaders,
  objectExists,
  uploadFile,
} from "@/lib/oss";
import { prisma } from "@/lib/prisma";
import { getOwnedCanvas } from "@/models/canvas";
import { findUserByEmail } from "@/models/user";
import { buildSongPackage, embedLyricsInMp3 } from "@/services/audio-download";
import type { CanvasNodeOutput } from "@/types/canvas";

export const runtime = "nodejs";

function asTimedWords(value: unknown): TimedLyricWord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TimedLyricWord =>
      !!item &&
      typeof item === "object" &&
      typeof (item as TimedLyricWord).text === "string" &&
      Number.isFinite((item as TimedLyricWord).startMs) &&
      Number.isFinite((item as TimedLyricWord).endMs)
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  const canvasId = Number(req.nextUrl.searchParams.get("canvasId"));
  const nodeId = req.nextUrl.searchParams.get("nodeId")?.trim();
  const format = req.nextUrl.searchParams.get("format");
  if (!Number.isInteger(canvasId) || canvasId <= 0 || !nodeId || !["mp3", "zip"].includes(format ?? "")) {
    return new Response("Invalid parameters", { status: 400 });
  }

  const user = await findUserByEmail(auth.email);
  if (!user?.id || !(await getOwnedCanvas(user.id, canvasId))) {
    return new Response("Not found", { status: 404 });
  }

  const stepRun = await prisma.step_runs.findFirst({
    where: {
      node_id: nodeId,
      status: "succeeded",
      execution: { canvas_id: canvasId },
    },
    select: { output_json: true },
    orderBy: { id: "desc" },
  });
  const output = stepRun?.output_json as CanvasNodeOutput | null | undefined;
  if (!output || output.kind !== "audio") {
    return new Response("Audio lyrics not found", { status: 404 });
  }
  const storageKey = output.storageKeys?.[0];
  const lyrics = typeof output.meta?.lyrics === "string" ? output.meta.lyrics : "";
  if (!storageKey || !lyrics) return new Response("Audio lyrics not found", { status: 404 });

  const title =
    typeof output.meta?.title === "string" && output.meta.title.trim()
      ? output.meta.title.trim()
      : "song";
  const timedWords = asTimedWords(output.meta?.timedWords);
  const extension = format === "zip" ? "zip" : "mp3";
  const fileName = `${safeSongFilename(title)}.${extension}`;
  const hash = createHash("sha256")
    .update(JSON.stringify({ version: 1, storageKey, title, lyrics, timedWords, format }))
    .digest("hex");
  const cacheKey = `canvas/downloads/${hash}.${extension}`;

  if (!(await objectExists(cacheKey))) {
    const audioResponse = await axios.get(getSignedInternalUrl(storageKey), {
      responseType: "arraybuffer",
      timeout: 300_000,
      headers: internalDownloadHeaders(),
    });
    const audio = Buffer.from(audioResponse.data);
    const derivative =
      format === "zip"
        ? await buildSongPackage(audio, title, lyrics, timedWords)
        : embedLyricsInMp3(audio, title, lyrics, timedWords);
    await uploadFile(derivative, cacheKey);
  }

  const url = getSignedDownloadUrl(cacheKey, fileName, 600);
  return req.headers.get("accept")?.includes("application/json")
    ? Response.json({ url })
    : Response.redirect(url, 302);
}
