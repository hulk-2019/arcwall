import { describe, expect, it } from "vitest";
import {
  assertReferenceAudioFitsSeedance,
  clampVideoDuration,
  clampVideoResolution,
  probeAudioDurationSec,
  videoDurationOptions,
  videoResolutionOptions,
} from "./seedance";

function silentWav(seconds: number, sampleRate = 8000) {
  const samples = seconds * sampleRate;
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

describe("Seedance request constraints", () => {
  it("rejects Seedance 2.0 durations below 4 seconds", () => {
    expect(clampVideoDuration("doubao-seedance-2-0-fast-260128", 3)).toBe(4);
    expect(clampVideoDuration("doubao-seedance-2-0-260128", 20)).toBe(15);
    expect(videoDurationOptions("doubao-seedance-2-0-fast-260128")[0]).toBe(4);
  });

  it("still allows 2-12s for Seedance 1.0", () => {
    expect(clampVideoDuration("doubao-seedance-1-0-pro-250528", 3)).toBe(3);
    expect(clampVideoDuration("doubao-seedance-1-0-lite-t2v-250428", 15)).toBe(12);
  });

  it("downgrades 1080p for all Seedance 2.0 models", () => {
    expect(clampVideoResolution("doubao-seedance-2-0-fast-260128", "1080p")).toBe(
      "720p"
    );
    expect(clampVideoResolution("doubao-seedance-2-0-260128", "1080p")).toBe("720p");
    expect(clampVideoResolution("doubao-seedance-1-0-pro-250528", "1080p")).toBe(
      "1080p"
    );
    expect(videoResolutionOptions("doubao-seedance-2-0-260128")).not.toContain(
      "1080p"
    );
  });

  it("reads wav duration and rejects reference audio outside 2-15s", () => {
    expect(probeAudioDurationSec(silentWav(8))).toBeCloseTo(8, 1);
    expect(() =>
      assertReferenceAudioFitsSeedance({
        durationSec: probeAudioDurationSec(silentWav(20)),
        byteLength: silentWav(8).length,
      })
    ).toThrow(/2[–-]15/);
    expect(() =>
      assertReferenceAudioFitsSeedance({
        durationSec: 8,
        byteLength: silentWav(8).length,
      })
    ).not.toThrow();
  });
});
