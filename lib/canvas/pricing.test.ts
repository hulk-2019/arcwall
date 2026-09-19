import { describe, expect, it } from "vitest";
import {
  AUDIO_CREDITS,
  CREDIT_PACKAGES,
  CREDIT_SELL_CNY,
  TEXT_CREDITS,
  creditsFromVendorCost,
  estimateAudioCredits,
  estimateImageCredits,
  estimateTextCredits,
  estimateVideoCredits,
  packageCapacity,
  packageYuanPerCredit,
} from "./pricing";
import { estimateNodeCost } from "./registry";

describe("credit packages", () => {
  it("sells every pack at 0.50 yuan per credit", () => {
    expect(CREDIT_SELL_CNY).toBe(0.5);
    expect(CREDIT_PACKAGES.map((pack) => pack.credits)).toEqual([20, 100, 200]);
    for (const pack of CREDIT_PACKAGES) {
      expect(packageYuanPerCredit(pack)).toBe(0.5);
    }
  });

  it("summarizes how much each pack can generate without a rate table", () => {
    expect(packageCapacity(20)).toEqual({
      seedreamImages: 20,
      gpt2kImages: 4,
      songs: 3,
      videos: 0,
    });
    expect(packageCapacity(100).videos).toBe(3);
    expect(packageCapacity(200).videos).toBe(7);
  });
});

describe("creditsFromVendorCost", () => {
  it("ceils toward the user and never rounds down", () => {
    expect(creditsFromVendorCost(0.25, 2)).toBe(1);
    expect(creditsFromVendorCost(5.137, 2.5, 3)).toBe(26);
    expect(creditsFromVendorCost(0, 2)).toBe(0);
  });
});

describe("image credits", () => {
  it("keeps Seedream at 1 credit", () => {
    expect(estimateImageCredits("doubao-seedream-4-5-251128")).toBe(1);
    expect(estimateImageCredits("doubao-seedream-4-0-250828", "2k")).toBe(1);
    expect(estimateImageCredits("doubao-seedream-3-0-t2i-250415")).toBe(1);
  });

  it("charges GPT-Image and Nano Banana by model and resolution", () => {
    expect(estimateImageCredits("gpt-image-2", "1k")).toBe(3);
    expect(estimateImageCredits("gpt-image-2", "2k")).toBe(5);
    expect(estimateImageCredits("gemini-3.1-flash-image-preview", "1k")).toBe(3);
    expect(estimateImageCredits("gemini-3.1-flash-image-preview", "2k")).toBe(4);
    expect(estimateImageCredits("gemini-3-pro-image-preview")).toBe(5);
  });

  it("uses a conservative fallback for unknown image models", () => {
    expect(estimateImageCredits("unknown-image-model", "2k")).toBe(5);
  });
});

describe("video credits", () => {
  it("prices Seedance 2.0 Fast 720p by the second", () => {
    expect(estimateVideoCredits("doubao-seedance-2-0-fast-260128", 5, "720p")).toBe(26);
    expect(estimateVideoCredits("doubao-seedance-2-0-fast-260128", 15, "720p")).toBe(78);
  });

  it("charges more for standard 2.0 and 1080p", () => {
    expect(estimateVideoCredits("doubao-seedance-2-0-260128", 5, "720p")).toBe(32);
    expect(estimateVideoCredits("doubao-seedance-2-0-260128", 5, "1080p")).toBe(70);
  });

  it("keeps a 3-credit floor for cheap short clips", () => {
    expect(estimateVideoCredits("doubao-seedance-1-0-lite-t2v-250428", 2, "480p")).toBeGreaterThanOrEqual(3);
  });
});

describe("audio and text credits", () => {
  it("charges Suno six credits and text actions one", () => {
    expect(estimateAudioCredits()).toBe(6);
    expect(AUDIO_CREDITS).toBe(6);
    expect(estimateTextCredits()).toBe(1);
    expect(TEXT_CREDITS).toBe(1);
  });
});

describe("estimateNodeCost", () => {
  it("uses node config instead of a flat per-type price", () => {
    expect(estimateNodeCost("text")).toBe(0);
    expect(estimateNodeCost("upload")).toBe(0);
    expect(estimateNodeCost("storyboard")).toBe(1);
    expect(estimateNodeCost("audio", { model: "suno-v5" })).toBe(6);
    expect(estimateNodeCost("image", { model: "doubao-seedream-4-5-251128" })).toBe(1);
    expect(estimateNodeCost("image", { model: "gpt-image-2", resolution: "2k" })).toBe(5);
    expect(
      estimateNodeCost("video", {
        model: "doubao-seedance-2-0-fast-260128",
        duration: 5,
        resolution: "1080p",
      })
    ).toBe(26);
  });
});
