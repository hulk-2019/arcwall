import { NextRequest } from "next/server";
import { requireAuthOrResponse } from "@/lib/auth";
import { safeSongFilename } from "@/lib/audio-lyrics";
import { getSignedDownloadUrl } from "@/lib/oss";
import { prisma } from "@/lib/prisma";
import { getOwnedCanvas } from "@/models/canvas";
import { findUserByEmail } from "@/models/user";
import type { CanvasNodeConfig, CanvasNodeOutput } from "@/types/canvas";

function fileExtension(storageKey: string): string {
  return storageKey.match(/(\.[A-Za-z0-9]{1,10})$/)?.[1] ?? "";
}

function downloadFileName(
  output: CanvasNodeOutput,
  config: CanvasNodeConfig,
  storageKey: string,
  index: number
): string {
  const extension = fileExtension(storageKey);
  const title =
    (typeof output.meta?.title === "string" && output.meta.title) ||
    config.fileName ||
    config.title ||
    output.kind;
  const safeTitle = safeSongFilename(title);
  const base = extension && safeTitle.toLowerCase().endsWith(extension.toLowerCase())
    ? safeTitle.slice(0, -extension.length)
    : safeTitle;
  const suffix = (output.storageKeys?.length ?? 0) > 1 ? `-${index + 1}` : "";
  return `${base}${suffix}${extension}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuthOrResponse(req);
  if (auth instanceof Response) return auth;

  const canvasId = Number(req.nextUrl.searchParams.get("canvasId"));
  const nodeId = req.nextUrl.searchParams.get("nodeId")?.trim();
  const index = Number(req.nextUrl.searchParams.get("index") ?? "0");
  if (!Number.isInteger(canvasId) || canvasId <= 0 || !nodeId || !Number.isInteger(index) || index < 0) {
    return new Response("Invalid parameters", { status: 400 });
  }

  const user = await findUserByEmail(auth.email);
  if (!user?.id || !(await getOwnedCanvas(user.id, canvasId))) {
    return new Response("Not found", { status: 404 });
  }

  const node = await prisma.nodes.findFirst({
    where: { id: nodeId, canvas_id: canvasId },
    select: {
      type: true,
      current_revision: { select: { config_json: true } },
    },
  });
  if (!node) return new Response("File not found", { status: 404 });

  const stepRun = await prisma.step_runs.findFirst({
    where: {
      node_id: nodeId,
      status: "succeeded",
      execution: { canvas_id: canvasId },
    },
    select: {
      output_json: true,
      node_revision: { select: { config_json: true } },
    },
    orderBy: { id: "desc" },
  });
  const config = (stepRun?.node_revision?.config_json ??
    node.current_revision?.config_json ??
    {}) as CanvasNodeConfig;
  let output = stepRun?.output_json as CanvasNodeOutput | null | undefined;
  if (!output && node.type === "upload" && typeof config.storageKey === "string") {
    const kind =
      config.mediaType === "video" ? "video" : config.mediaType === "audio" ? "audio" : "image";
    output = { kind, storageKeys: [config.storageKey] };
  }
  const storageKey = output?.storageKeys?.[index];
  if (!output || !storageKey) return new Response("File not found", { status: 404 });

  const fileName = downloadFileName(output, config, storageKey, index);
  const url = getSignedDownloadUrl(storageKey, fileName, 600);
  return req.headers.get("accept")?.includes("application/json")
    ? Response.json({ url })
    : Response.redirect(url, 302);
}
