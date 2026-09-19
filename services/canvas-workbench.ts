import { prisma } from "@/lib/prisma";
import {
  copyOssObject,
  generateWorkbenchMediaKeys,
  getOssObjectBuffer,
  uploadFile,
  uploadJpegThumbnail,
} from "@/lib/oss";
import type { CanvasNodeConfig, CanvasNodeOutput } from "@/types/canvas";

export class CanvasWorkbenchError extends Error {
  constructor(public code: "unsupported" | "no_media") {
    super(code);
    this.name = "CanvasWorkbenchError";
  }
}

type WorkbenchMediaType = "image" | "video" | "audio";

function fileExtension(storageKey: string): string {
  return storageKey.match(/(\.[A-Za-z0-9]{1,10})$/)?.[1] ?? "";
}

function resolveMediaType(
  nodeType: string,
  config: CanvasNodeConfig
): WorkbenchMediaType | null {
  if (nodeType === "image" || nodeType === "video" || nodeType === "audio") {
    return nodeType;
  }
  if (nodeType === "upload") {
    if (config.mediaType === "video") return "video";
    if (config.mediaType === "audio") return "audio";
    return "image";
  }
  return null;
}

function resolveStorageKeys(
  nodeType: string,
  config: CanvasNodeConfig,
  output?: CanvasNodeOutput | null
): string[] {
  const fromOutput = (output?.storageKeys ?? []).filter(
    (key): key is string => typeof key === "string" && key.length > 0
  );
  if (fromOutput.length > 0) return fromOutput;
  if (nodeType === "upload" && typeof config.storageKey === "string" && config.storageKey) {
    return [config.storageKey];
  }
  return [];
}

function workbenchDescription(
  config: CanvasNodeConfig,
  output?: CanvasNodeOutput | null
): string {
  if (typeof config.prompt === "string" && config.prompt.trim()) return config.prompt.trim();
  if (typeof output?.meta?.title === "string" && output.meta.title.trim()) {
    return output.meta.title.trim();
  }
  if (typeof config.title === "string" && config.title.trim()) return config.title.trim();
  if (typeof config.fileName === "string" && config.fileName.trim()) return config.fileName.trim();
  return "";
}

export async function saveCanvasMediaToWorkbench(input: {
  userId: number;
  canvasId: number;
  nodeId: string;
}): Promise<{ saved: number; alreadySaved: number; ids: number[] }> {
  const { userId, canvasId, nodeId } = input;

  const node = await prisma.nodes.findFirst({
    where: { id: nodeId, canvas_id: canvasId },
    select: {
      type: true,
      current_revision: { select: { config_json: true } },
    },
  });
  if (!node) throw new CanvasWorkbenchError("no_media");

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
  const output = (stepRun?.output_json as CanvasNodeOutput | null | undefined) ?? null;
  const mediaType = resolveMediaType(node.type, config);
  if (!mediaType) throw new CanvasWorkbenchError("unsupported");

  const storageKeys = resolveStorageKeys(node.type, config, output);
  if (storageKeys.length === 0) throw new CanvasWorkbenchError("no_media");

  let saved = 0;
  let alreadySaved = 0;
  const ids: number[] = [];

  for (const storageKey of storageKeys) {
    const existing = await prisma.wallpapers.findFirst({
      where: {
        user_id: userId,
        is_delete: false,
        is_permanently_delete: false,
        AND: [
          { llm_params: { path: ["source", "nodeId"], equals: nodeId } },
          { llm_params: { path: ["source", "storageKey"], equals: storageKey } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      alreadySaved += 1;
      ids.push(existing.id);
      continue;
    }

    const keys = generateWorkbenchMediaKeys(fileExtension(storageKey));
    let imgPath: string;
    let thumbnailPath: string | undefined;
    if (mediaType === "image") {
      const buffer = await getOssObjectBuffer(storageKey);
      imgPath = await uploadFile(buffer, keys.original);
      thumbnailPath = await uploadJpegThumbnail(buffer, keys.thumbnail);
    } else {
      imgPath = await copyOssObject(storageKey, keys.original);
    }

    const row = await prisma.wallpapers.create({
      data: {
        user_id: userId,
        img_description: workbenchDescription(config, output),
        img_size:
          typeof output?.meta?.size === "string" ? output.meta.size : undefined,
        model_key: typeof config.model === "string" ? config.model : undefined,
        aspect_ratio_key:
          typeof config.aspectRatio === "string" ? config.aspectRatio : undefined,
        img_path: imgPath,
        img_thumbnail_path: thumbnailPath,
        media_type: mediaType,
        status: 1,
        llm_params: {
          source: {
            kind: "canvas",
            canvasId,
            nodeId,
            storageKey,
            nodeType: node.type,
          },
        },
        created_at: new Date(),
      },
    });
    saved += 1;
    ids.push(row.id);
  }

  return { saved, alreadySaved, ids };
}
