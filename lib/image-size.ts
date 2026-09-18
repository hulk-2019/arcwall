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
