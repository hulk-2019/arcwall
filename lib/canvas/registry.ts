import type { CanvasNodeType, OutputKind, CanvasNodeConfig } from "@/types/canvas";

/**
 * 能力注册表：节点类型、端口、连线兼容规则、模型与成本。
 * 遵循技术方案 §八点一 的连线兼容规则，UI 与服务端共用同一份定义。
 */

export interface NodePort {
  port: string;
  accepts: OutputKind[]; // 该输入端口可接收的上游输出类型
}

export interface NodeTypeDef {
  type: CanvasNodeType;
  label: { zh: string; en: string };
  icon: string;
  inputs: NodePort[];
  outputs: { port: string; kind: OutputKind }[];
  baseCost: number; // 面板展示用的基准单价（image 按张、video 按条）
  executable: boolean; // 是否真正调用模型执行（text/upload 节点不执行）
  defaults: CanvasNodeConfig;
}

export const OUTPUT_PORT = "output";

export const IMAGE_MODEL_DEFAULT =
  process.env.CANVAS_IMAGE_MODEL || "doubao-seedream-4-5-251128";

export const STORYBOARD_MODEL =
  process.env.CANVAS_STORYBOARD_MODEL || "doubao-seed-2-0-lite-260215";

export const VIDEO_MODEL_DEFAULT =
  process.env.CANVAS_VIDEO_MODEL || "doubao-seedance-2-0-fast-260128";

/** TTS 模型与音色依赖供应商开通情况，可通过环境变量覆盖 */
export const AUDIO_MODEL_DEFAULT =
  process.env.CANVAS_AUDIO_MODEL || "doubao-seed-tts-1-0";

export const AUDIO_VOICE_DEFAULT =
  process.env.CANVAS_AUDIO_VOICE || "zh_female_cancan_mars_bigtreenlm";

export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"];

/** 文本节点 AI 润色的单次计费（PRD-NOD-003，独立于画布执行） */
export const POLISH_TEXT_COST = 1;

export const NODE_TYPE_DEFS: Record<CanvasNodeType, NodeTypeDef> = {
  text: {
    type: "text",
    label: { zh: "文本", en: "Text" },
    icon: "text",
    inputs: [{ port: "text", accepts: ["text"] }], // PRD §八点一：文本→文本，按顺序合并
    outputs: [{ port: OUTPUT_PORT, kind: "text" }],
    baseCost: 0,
    executable: false,
    defaults: { title: "文本", text: "" },
  },
  image: {
    type: "image",
    label: { zh: "图像生成", en: "Image" },
    icon: "image",
    inputs: [
      { port: "prompt", accepts: ["text", "storyboard"] },
      { port: "reference_images", accepts: ["image"] },
    ],
    outputs: [{ port: OUTPUT_PORT, kind: "image" }],
    baseCost: 1,
    executable: true,
    defaults: {
      title: "图像生成",
      prompt: "",
      model: IMAGE_MODEL_DEFAULT,
      aspectRatio: "16:9",
      count: 1,
      referenceImages: [],
    },
  },
  storyboard: {
    type: "storyboard",
    label: { zh: "分镜规划", en: "Storyboard" },
    icon: "film",
    inputs: [{ port: "brief", accepts: ["text"] }],
    outputs: [{ port: OUTPUT_PORT, kind: "storyboard" }],
    baseCost: 1,
    executable: true,
    defaults: {
      title: "分镜规划",
      brief: "",
      visualLock: {},
      shots: [],
      layout: "grid9",
    },
  },
  video: {
    type: "video",
    label: { zh: "视频生成", en: "Video" },
    icon: "video",
    inputs: [
      { port: "prompt", accepts: ["text", "storyboard"] },
      { port: "first_frame", accepts: ["image"] },
      { port: "reference_audio", accepts: ["audio"] },
    ],
    outputs: [{ port: OUTPUT_PORT, kind: "video" }],
    baseCost: 3,
    executable: true,
    defaults: {
      title: "视频生成",
      prompt: "",
      videoMode: "text",
      duration: 5,
      resolution: "1080p",
      aspectRatio: "16:9",
      model: VIDEO_MODEL_DEFAULT,
    },
  },
  audio: {
    type: "audio",
    label: { zh: "音频生成", en: "Audio" },
    icon: "audio",
    inputs: [{ port: "prompt", accepts: ["text"] }],
    outputs: [{ port: OUTPUT_PORT, kind: "audio" }],
    baseCost: 1,
    executable: true,
    defaults: {
      title: "音频生成",
      text: "",
      model: AUDIO_MODEL_DEFAULT,
      voice: AUDIO_VOICE_DEFAULT,
      speed: 1,
    },
  },
  upload: {
    type: "upload",
    label: { zh: "上传素材", en: "Upload" },
    icon: "upload",
    inputs: [],
    // 输出类型随上传文件类型变化，见 nodeOutputKind
    outputs: [{ port: OUTPUT_PORT, kind: "image" }],
    baseCost: 0,
    executable: false,
    defaults: {
      title: "上传素材",
      storageKey: "",
      fileName: "",
      mediaType: "image",
    },
  },
};

export function getNodeTypeDef(type: CanvasNodeType): NodeTypeDef {
  return NODE_TYPE_DEFS[type];
}

/**
 * 节点的实际输出类型。upload 节点随上传文件的 mediaType 变化
 * （image / video / audio），其余节点取静态定义。
 */
export function nodeOutputKind(type: CanvasNodeType, config?: CanvasNodeConfig): OutputKind {
  if (type === "upload") {
    if (config?.mediaType === "video") return "video";
    if (config?.mediaType === "audio") return "audio";
    return "image";
  }
  return NODE_TYPE_DEFS[type].outputs[0].kind;
}

/**
 * 按节点配置计价。估算（estimate）与实际结算（capture）使用同一函数，
 * 保证预扣与最终结算一致（技术方案 §十二）。
 */
export function estimateNodeCost(type: CanvasNodeType, config?: CanvasNodeConfig): number {
  const def = NODE_TYPE_DEFS[type];
  if (!def.executable) return 0;
  if (type === "image") {
    const count = Math.max(1, Math.min(4, Number(config?.count) || 1));
    return def.baseCost * count;
  }
  return def.baseCost;
}

/**
 * 连线兼容：给定上游节点的输出类型和目标节点类型，返回应连接的目标端口。
 * 若目标节点不接受该输出类型，返回 null（连接被拒绝）。
 */
export function resolveTargetPort(
  sourceKind: OutputKind,
  targetType: CanvasNodeType
): string | null {
  const def = NODE_TYPE_DEFS[targetType];
  const port = def.inputs.find((p) => p.accepts.includes(sourceKind));
  return port ? port.port : null;
}

/**
 * 判断一条连线是否合法。
 */
export function isConnectionAllowed(
  sourceType: CanvasNodeType,
  targetType: CanvasNodeType
): boolean {
  const sourceKind = NODE_TYPE_DEFS[sourceType].outputs[0].kind;
  return resolveTargetPort(sourceKind, targetType) !== null;
}

export const NODE_TYPES: CanvasNodeType[] = [
  "text",
  "image",
  "storyboard",
  "video",
  "audio",
  "upload",
];

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"];

// ---------------------------------------------------------------------------
// 上传素材约束（客户端与服务端共用同一份定义，PRD-AST-001）
// ---------------------------------------------------------------------------

export type UploadMediaKind = "image" | "video" | "audio";

/** 允许的 MIME 类型 → 媒体类型与存储扩展名 */
export const UPLOAD_MIME_TYPES: Record<string, { kind: UploadMediaKind; ext: string }> = {
  "image/png": { kind: "image", ext: "png" },
  "image/jpeg": { kind: "image", ext: "jpg" },
  "image/jpg": { kind: "image", ext: "jpg" },
  "image/webp": { kind: "image", ext: "webp" },
  "image/gif": { kind: "image", ext: "gif" },
  "video/mp4": { kind: "video", ext: "mp4" },
  "video/quicktime": { kind: "video", ext: "mov" },
  "video/webm": { kind: "video", ext: "webm" },
  "video/x-m4v": { kind: "video", ext: "m4v" },
  "audio/mpeg": { kind: "audio", ext: "mp3" },
  "audio/mp3": { kind: "audio", ext: "mp3" },
  "audio/wav": { kind: "audio", ext: "wav" },
  "audio/x-wav": { kind: "audio", ext: "wav" },
  "audio/mp4": { kind: "audio", ext: "m4a" },
  "audio/x-m4a": { kind: "audio", ext: "m4a" },
  "audio/aac": { kind: "audio", ext: "aac" },
  "audio/ogg": { kind: "audio", ext: "ogg" },
  "audio/flac": { kind: "audio", ext: "flac" },
  "audio/x-flac": { kind: "audio", ext: "flac" },
};

/** 分类型大小限制（字节） */
export const UPLOAD_SIZE_LIMITS: Record<UploadMediaKind, number> = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
};

export const UPLOAD_ACCEPT = "image/*,video/*,audio/*";
