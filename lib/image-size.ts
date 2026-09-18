export type ImageResolution = "1k" | "2k";

export const IMAGE_RESOLUTION_OPTIONS: Array<{ value: ImageResolution; label: string }> = [
  { value: "1k", label: "1K" },
  { value: "2k", label: "2K" },
];

export function normalizeImageResolution(value: unknown): ImageResolution {
  return value === "1k" ? "1k" : "2k";
}

/** 将 2K 像素尺寸按半边长缩到 1K，宽高对齐 16 的倍数 */
export function scalePixelSize(size: string, resolution: ImageResolution): string {
  if (resolution === "2k") return size;
  const [widthStr, heightStr] = size.split("x");
  const width = Number(widthStr);
  const height = Number(heightStr);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return size;
  const round16 = (n: number) => Math.max(16, Math.round(n / 2 / 16) * 16);
  return `${round16(width)}x${round16(height)}`;
}

/** gpt-image-2：1K/2K 指长边 1024/2048，宽高须为 16 的倍数 */
export function gptImageSize(aspectRatio: string, resolution: string): string {
  const m = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/.exec(aspectRatio || "");
  const w = m ? Number(m[1]) : 16;
  const h = m ? Number(m[2]) : 9;
  const long = resolution === "2k" ? 2048 : 1024;
  const round16 = (v: number) => Math.max(16, Math.round(v / 16) * 16);
  if (w >= h) {
    return `${long}x${round16((long * h) / w)}`;
  }
  return `${round16((long * w) / h)}x${long}`;
}
