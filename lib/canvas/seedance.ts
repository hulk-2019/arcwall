export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"];

export const MIN_SEEDANCE2_DURATION = 4;
export const MAX_SEEDANCE2_DURATION = 15;
export const MIN_SEEDANCE1_DURATION = 2;
export const MAX_SEEDANCE1_DURATION = 12;
export const MIN_REFERENCE_AUDIO_SEC = 2;
export const MAX_REFERENCE_AUDIO_SEC = 15;
export const MAX_REFERENCE_AUDIO_BYTES = 15 * 1024 * 1024;

export function isSeedance2(model: string): boolean {
  return /seedance-2-0/i.test(model);
}

export function videoDurationRange(model: string): { min: number; max: number } {
  return isSeedance2(model)
    ? { min: MIN_SEEDANCE2_DURATION, max: MAX_SEEDANCE2_DURATION }
    : { min: MIN_SEEDANCE1_DURATION, max: MAX_SEEDANCE1_DURATION };
}

export function videoDurationOptions(model: string): number[] {
  const { min, max } = videoDurationRange(model);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function clampVideoDuration(model: string, duration: number | undefined): number {
  const { min, max } = videoDurationRange(model);
  const n = Number(duration);
  const value = Number.isFinite(n) ? Math.round(n) : 5;
  return Math.min(max, Math.max(min, value));
}

export function videoResolutionOptions(model: string): string[] {
  if (isSeedance2(model)) {
    return VIDEO_RESOLUTIONS.filter((value) => value !== "1080p");
  }
  return [...VIDEO_RESOLUTIONS];
}

export function clampVideoResolution(model: string, resolution: string | undefined): string {
  const fallback = isSeedance2(model) ? "720p" : "1080p";
  const value = resolution || fallback;
  if (isSeedance2(model) && value === "1080p") return "720p";
  return value;
}

export function probeAudioDurationSec(buffer: Buffer): number | undefined {
  return wavDurationSec(buffer) ?? mp3DurationSec(buffer);
}

export function assertReferenceAudioFitsSeedance(input: {
  durationSec?: number;
  byteLength: number;
}): void {
  if (input.byteLength > MAX_REFERENCE_AUDIO_BYTES) {
    throw new Error("参考音频需不超过 15MB");
  }
  if (input.durationSec == null) return;
  if (
    input.durationSec < MIN_REFERENCE_AUDIO_SEC ||
    input.durationSec > MAX_REFERENCE_AUDIO_SEC
  ) {
    throw new Error("参考音频时长需 2–15 秒，当前音乐过长");
  }
}

function wavDurationSec(buffer: Buffer): number | undefined {
  if (buffer.length < 44) return undefined;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return undefined;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return undefined;

  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const next = offset + 8 + size + (size % 2);
    if (id === "fmt " && size >= 8) {
      byteRate = buffer.readUInt32LE(offset + 16);
    } else if (id === "data") {
      dataSize = size;
      break;
    }
    if (next <= offset) break;
    offset = next;
  }
  if (byteRate <= 0 || dataSize <= 0) return undefined;
  return dataSize / byteRate;
}

const MP3_BITRATES: Record<string, number[]> = {
  "1-1": [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  "1-2": [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  "1-3": [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  "2-1": [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  "2-2": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  "2-3": [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

const MP3_SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

function mp3DurationSec(buffer: Buffer): number | undefined {
  const frame = findMp3Frame(buffer);
  if (!frame) return undefined;

  const xing = readXingFrames(buffer, frame);
  if (xing && frame.sampleRate > 0) {
    return (xing * frame.samplesPerFrame) / frame.sampleRate;
  }
  if (frame.bitrateKbps > 0) {
    return (buffer.length * 8) / (frame.bitrateKbps * 1000);
  }
  return undefined;
}

function findMp3Frame(buffer: Buffer): {
  offset: number;
  versionId: number;
  layer: number;
  bitrateKbps: number;
  sampleRate: number;
  samplesPerFrame: number;
  padding: number;
} | undefined {
  for (let i = 0; i < buffer.length - 4; i++) {
    if (buffer[i] !== 0xff || (buffer[i + 1] & 0xe0) !== 0xe0) continue;
    const b1 = buffer[i + 1];
    const b2 = buffer[i + 2];
    const versionId = (b1 >> 3) & 0x03;
    const layer = (b1 >> 1) & 0x03;
    if (versionId === 1 || layer === 0) continue;
    const bitrateIndex = b2 >> 4;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;
    const version = versionId === 3 ? 1 : 2;
    const layerNo = 4 - layer;
    const rates = MP3_BITRATES[`${version}-${layerNo}`];
    const sampleRates = MP3_SAMPLE_RATES[versionId];
    if (!rates || !sampleRates) continue;
    const bitrateKbps = rates[bitrateIndex];
    const sampleRate = sampleRates[sampleRateIndex];
    if (!bitrateKbps || !sampleRate) continue;
    const padding = (b2 >> 1) & 0x01;
    const samplesPerFrame = layerNo === 1 ? 384 : version === 1 ? 1152 : 576;
    return {
      offset: i,
      versionId,
      layer,
      bitrateKbps,
      sampleRate,
      samplesPerFrame,
      padding,
    };
  }
  return undefined;
}

function readXingFrames(
  buffer: Buffer,
  frame: NonNullable<ReturnType<typeof findMp3Frame>>
): number | undefined {
  const channelMode = (buffer[frame.offset + 3] >> 6) & 0x03;
  const mpeg1 = frame.versionId === 3;
  const sideInfo = mpeg1 ? (channelMode === 3 ? 17 : 32) : channelMode === 3 ? 9 : 17;
  const tagOffset = frame.offset + 4 + sideInfo;
  if (tagOffset + 12 > buffer.length) return undefined;
  const tag = buffer.toString("ascii", tagOffset, tagOffset + 4);
  if (tag !== "Xing" && tag !== "Info") return undefined;
  const flags = buffer.readUInt32BE(tagOffset + 4);
  if ((flags & 0x0001) === 0) return undefined;
  return buffer.readUInt32BE(tagOffset + 8);
}
