import { clampVideoDuration, clampVideoResolution } from "./seedance";
import type { CanvasNodeConfig, CanvasNodeType } from "@/types/canvas";

/** Frozen with the 2026-09-19 no-loss rate card. */
export const PRICE_VERSION = "2026-09-19";

/** User-facing yuan per credit. All sellable packs must keep this ratio. */
export const CREDIT_SELL_CNY = 0.5;
export const SAFETY_IMAGE = 2;
export const SAFETY_MEDIA = 2.5;
export const TEXT_CREDITS = 1;
export const AUDIO_CREDITS = 6;
export const VIDEO_MIN_CREDITS = 3;
export const UNKNOWN_IMAGE_CREDITS = 5;

const USD_CNY = 7.3;
const VIDEO_FPS = 24;

export type CreditPackage = {
  id: "starter" | "standard" | "large";
  amountCny: number;
  credits: number;
  featured: boolean;
};

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "starter", amountCny: 10, credits: 20, featured: false },
  { id: "standard", amountCny: 50, credits: 100, featured: true },
  { id: "large", amountCny: 100, credits: 200, featured: false },
];

export type PackageCapacity = {
  seedreamImages: number;
  gpt2kImages: number;
  songs: number;
  videos: number;
};

/** Approximate output counts for marketing copy; uses the same estimators as billing. */
export function packageCapacity(credits: number): PackageCapacity {
  const imageCost = estimateImageCredits("doubao-seedream-4-5-251128");
  const gpt2kCost = estimateImageCredits("gpt-image-2", "2k");
  const videoCost = estimateVideoCredits("doubao-seedance-2-0-fast-260128", 5, "720p");
  return {
    seedreamImages: Math.floor(credits / imageCost),
    gpt2kImages: Math.floor(credits / gpt2kCost),
    songs: Math.floor(credits / AUDIO_CREDITS),
    videos: Math.floor(credits / videoCost),
  };
}

export function packageYuanPerCredit(pack: CreditPackage): number {
  return pack.amountCny / pack.credits;
}

export function creditsFromVendorCost(
  costCny: number,
  safety: number,
  minCredits = 1
): number {
  if (costCny <= 0) return 0;
  return Math.max(minCredits, Math.ceil((costCny * safety) / CREDIT_SELL_CNY));
}

const IMAGE_FLAT_CREDITS: Record<string, number> = {
  "doubao-seedream-4-5-251128": 1,
  "doubao-seedream-4-0-250828": 1,
  "doubao-seedream-3-0-t2i-250415": 1,
  "gemini-3-pro-image-preview": 5,
};

const IMAGE_RESOLUTION_CREDITS: Record<string, { "1k": number; "2k": number }> = {
  "gpt-image-2": { "1k": 3, "2k": 5 },
  "gemini-3.1-flash-image-preview": { "1k": 3, "2k": 4 },
};

function normalizeResolution(resolution?: string): "1k" | "2k" {
  return resolution === "1k" ? "1k" : "2k";
}

export function estimateImageCredits(model?: string, resolution?: string): number {
  const key = (model || "").trim();
  if (key in IMAGE_FLAT_CREDITS) return IMAGE_FLAT_CREDITS[key];
  const byRes = IMAGE_RESOLUTION_CREDITS[key];
  if (byRes) return byRes[normalizeResolution(resolution)];
  if (/seedream/i.test(key)) return 1;
  return UNKNOWN_IMAGE_CREDITS;
}

const VIDEO_PIXELS: Record<string, { width: number; height: number }> = {
  "480p": { width: 864, height: 480 },
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

/** 302.ai PTC per million tokens, no reference video. */
function videoPtcPerMillion(model: string): number {
  if (/seedance-2-0-fast/i.test(model)) return 6.516;
  if (/seedance-2-0/i.test(model)) return 7.884;
  if (/seedance-1-0-lite/i.test(model)) return 1.5;
  if (/seedance-1-0-pro/i.test(model) || /seedance-1-0/i.test(model)) return 2.2;
  return 7.884;
}

function videoTokens(durationSec: number, resolution: string): number {
  const pixels = VIDEO_PIXELS[resolution] ?? VIDEO_PIXELS["720p"];
  return (durationSec * pixels.width * pixels.height * VIDEO_FPS) / 1024;
}

export function estimateVideoCredits(
  model?: string,
  duration?: number,
  resolution?: string
): number {
  const modelId = model || "doubao-seedance-2-0-fast-260128";
  const seconds = Number.isFinite(Number(duration)) ? Math.max(1, Number(duration)) : 5;
  const res = resolution && VIDEO_PIXELS[resolution] ? resolution : "720p";
  const costCny = (videoTokens(seconds, res) * videoPtcPerMillion(modelId) * USD_CNY) / 1_000_000;
  return creditsFromVendorCost(costCny, SAFETY_MEDIA, VIDEO_MIN_CREDITS);
}

export function estimateAudioCredits(): number {
  return AUDIO_CREDITS;
}

export function estimateTextCredits(): number {
  return TEXT_CREDITS;
}

export const RATE_CARD_ITEMS = [
  { key: "imageSeedream", credits: estimateImageCredits("doubao-seedream-4-5-251128") },
  { key: "imageGpt1k", credits: estimateImageCredits("gpt-image-2", "1k") },
  { key: "imageGpt2k", credits: estimateImageCredits("gpt-image-2", "2k") },
  { key: "imageBanana2_1k", credits: estimateImageCredits("gemini-3.1-flash-image-preview", "1k") },
  { key: "imageBanana2_2k", credits: estimateImageCredits("gemini-3.1-flash-image-preview", "2k") },
  { key: "imageBananaPro", credits: estimateImageCredits("gemini-3-pro-image-preview") },
  {
    key: "videoFast720p5",
    credits: estimateVideoCredits("doubao-seedance-2-0-fast-260128", 5, "720p"),
  },
  {
    key: "videoFast720p15",
    credits: estimateVideoCredits("doubao-seedance-2-0-fast-260128", 15, "720p"),
  },
  {
    key: "videoPro1080p5",
    credits: estimateVideoCredits("doubao-seedance-1-0-pro-250528", 5, "1080p"),
  },
  { key: "audioSuno", credits: AUDIO_CREDITS },
  { key: "textTools", credits: TEXT_CREDITS },
] as const;

/**
 * Shared estimator for canvas, wallpaper, and polish. Clamps video duration
 * and resolution the same way the executor does, so quote matches capture.
 */
export function estimateNodeCost(type: CanvasNodeType, config?: CanvasNodeConfig): number {
  if (type === "text" || type === "upload") return 0;
  if (type === "storyboard") return TEXT_CREDITS;
  if (type === "audio") return AUDIO_CREDITS;
  if (type === "image") return estimateImageCredits(config?.model, config?.resolution);
  if (type === "video") {
    const model = typeof config?.model === "string" ? config.model : "doubao-seedance-2-0-fast-260128";
    return estimateVideoCredits(
      model,
      clampVideoDuration(model, config?.duration),
      clampVideoResolution(model, config?.resolution)
    );
  }
  return 0;
}
