import type { AudioStyle, CanvasNodeType, OutputKind, CanvasNodeConfig } from "@/types/canvas";

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

/** 音频生成统一走 Suno（302.ai 代理），展示 ID → mv 版本码见 services/suno-proxy.ts */
export const SUNO_MODEL_OPTIONS = [
  "suno-v5.5",
  "suno-v5",
  "suno-v4.5plus",
  "suno-v4.5",
  "suno-v4",
];

export const AUDIO_MODEL_DEFAULT =
  process.env.CANVAS_AUDIO_MODEL || "suno-v5";

/** 音频生成模式：自定义歌词 / 自动写词成曲 / 纯音乐 */
export const AUDIO_MODES = ["custom", "auto", "instrumental"] as const;
export const AUDIO_VOCALS = ["male", "female"] as const;
export const AUDIO_STYLE_PRESETS: Array<{
  name: string;
  value: AudioStyle;
  keywords: string[];
}> = [
  { name: "流行", value: "pop", keywords: ["pop", "ballad", "acoustic"] },
  { name: "摇滚", value: "rock", keywords: ["rock", "indie", "alternative"] },
  { name: "电子", value: "electronic", keywords: ["electronic", "edm", "synthwave"] },
  { name: "嘻哈", value: "hip-hop", keywords: ["rap", "hip-hop", "trap"] },
  { name: "古典", value: "classical", keywords: ["classical", "orchestral", "piano"] },
  { name: "民谣", value: "folk", keywords: ["folk", "country", "bluegrass"] },
  { name: "爵士", value: "jazz", keywords: ["jazz", "blues", "soul"] },
];

export function audioStyleTags(style?: AudioStyle): string {
  return AUDIO_STYLE_PRESETS.find((preset) => preset.value === style)?.keywords.join(", ") ?? "";
}

export { VIDEO_RESOLUTIONS } from "./seedance";

/** 可选模型列表：逗号分隔环境变量可覆盖（依赖账号开通情况，默认含当前默认模型） */
function parseModelList(env: string | undefined, fallback: string[]): string[] {
  const parsed = (env || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

// ---------------------------------------------------------------------------
// 302.ai 代理模型（OpenAI 兼容 / Gemini 原生两种协议）
// ---------------------------------------------------------------------------

/** GPT-Image 系列：OpenAI 兼容 /v1/images/generations，支持 1K/2K（16 倍数尺寸） */
export const GPT_IMAGE_MODEL = "gpt-image-2";
/** Nano Banana 2：Gemini 原生 contents 格式，aspectRatio 控制画幅 */
export const GEMINI_NATIVE_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
/** Nano Banana Pro：OpenAI 兼容 chat/completions，图片以 markdown 链接返回 */
export const GEMINI_CHAT_IMAGE_MODEL = "gemini-3-pro-image-preview";

export type ImageModelProvider = "ark" | "gpt-image" | "gemini-native" | "gemini-chat";

export function imageModelProvider(model: string): ImageModelProvider {
  if (model === GPT_IMAGE_MODEL) return "gpt-image";
  if (model === GEMINI_NATIVE_IMAGE_MODEL) return "gemini-native";
  if (model === GEMINI_CHAT_IMAGE_MODEL) return "gemini-chat";
  return "ark";
}

/** 是否支持分辨率（1K/2K）选择 —— 当前仅 GPT-Image 系列 */
export function modelSupportsResolution(model: string): boolean {
  return imageModelProvider(model) === "gpt-image";
}

export const IMAGE_MODEL_OPTIONS: string[] = parseModelList(
  process.env.CANVAS_IMAGE_MODELS,
  [
    IMAGE_MODEL_DEFAULT,
    "doubao-seedream-4-0-250828",
    "doubao-seedream-3-0-t2i-250415",
    GPT_IMAGE_MODEL,
    GEMINI_NATIVE_IMAGE_MODEL,
    GEMINI_CHAT_IMAGE_MODEL,
  ]
);

export const VIDEO_MODEL_OPTIONS: string[] = parseModelList(process.env.CANVAS_VIDEO_MODELS, [
  VIDEO_MODEL_DEFAULT,
  "doubao-seedance-2-0-260128",
  "doubao-seedance-1-0-pro-250528",
  "doubao-seedance-1-0-lite-t2v-250428",
]);

export const AUDIO_MODEL_OPTIONS: string[] = parseModelList(
  process.env.CANVAS_AUDIO_MODELS,
  SUNO_MODEL_OPTIONS
);

/**
 * 全局模型池（可选）：设置 CANVAS_MODELS 后，各节点类型的可选模型
 * 从该池中按类型规则过滤（见 MODEL_FILTER_RULES），替代分类型环境变量。
 */
const MODEL_POOL: string[] = parseModelList(process.env.CANVAS_MODELS, []);

const MODEL_FILTER_RULES: Partial<Record<CanvasNodeType, RegExp[]>> = {
  image: [/seedream/i, /t2i/i, /gpt-image/i, /gemini-\d.*image/i],
  video: [/seedance/i],
  audio: [/suno/i],
};

/** 节点可选模型：全局池按类型过滤；未配置全局池时回退各类型默认列表 */
export function modelOptionsForType(type: CanvasNodeType): string[] {
  const defaults: Record<string, string[]> = {
    image: IMAGE_MODEL_OPTIONS,
    video: VIDEO_MODEL_OPTIONS,
    audio: AUDIO_MODEL_OPTIONS,
  };
  if (MODEL_POOL.length === 0) return defaults[type] ?? [];
  const rules = MODEL_FILTER_RULES[type];
  if (!rules) return [];
  const filtered = MODEL_POOL.filter((m) => rules.some((r) => r.test(m)));
  return filtered.length > 0 ? filtered : (defaults[type] ?? []);
}

/** 文本节点 AI 润色的单次计费（PRD-NOD-003，独立于画布执行） */
export { TEXT_CREDITS as POLISH_TEXT_COST } from "./pricing";
export { estimateNodeCost } from "./pricing";

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
    baseCost: 26,
    executable: true,
    defaults: {
      title: "视频生成",
      prompt: "",
      videoMode: "text",
      videoReferenceMode: "first_frame",
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
    baseCost: 6,
    executable: true,
    defaults: {
      title: "音频生成",
      text: "",
      model: AUDIO_MODEL_DEFAULT,
      mode: "auto",
      vocal: "female",
      style: "pop",
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
