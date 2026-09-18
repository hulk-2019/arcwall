import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("./hooks/useModelOptions", () => ({
  useModelOptions: () => [{ value: "video-model", label: "Video model" }],
}));

import { PropertyFields } from "./PropertyFields";

const labels = {
  titleLabel: "Title",
  model: "Model",
  mode: "Mode",
  vocal: "Vocal",
  modeCustom: "Custom lyrics",
  modeAuto: "Auto lyrics",
  modeInstrumental: "Instrumental",
  style: "Style",
  styles: {
    pop: "Pop",
    rock: "Rock",
    electronic: "Electronic",
    "hip-hop": "Hip-hop",
    classical: "Classical",
    folk: "Folk",
    jazz: "Jazz",
  },
  vocalMale: "Male",
  vocalFemale: "Female",
  aspectRatio: "Ratio",
  count: "Count",
  layout: "Layout",
  visualLock: "Visual lock",
  videoMode: "Video mode",
  videoModeText: "Text to video",
  videoModeImage: "Image to video",
  duration: "Duration",
  resolution: "Resolution",
  uploadFile: "Upload",
  uploading: "Uploading",
  uploadSuccess: "Uploaded",
  uploadFailed: "Upload failed",
  uploadTypeInvalid: "Invalid type",
  uploadTooLarge: "Too large",
  noFile: "No file",
  layouts: {},
};

describe("PropertyFields video mode", () => {
  it("shows image-to-video and locks the mode when a first-frame reference is connected", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="video"
        config={{ model: "video-model", videoMode: "text" }}
        hasVideoFirstFrame
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="image" selected="">Image to video</option>');
    expect(html).toMatch(/<select[^>]*disabled=""/);
  });
});

describe("PropertyFields audio mode (Suno)", () => {
  it("shows preset styles and vocal selection in custom mode", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="audio"
        config={{ model: "suno-v5", mode: "custom", style: "rock", vocal: "female" }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="custom" selected="">Custom lyrics</option>');
    expect(html).toContain('<option value="auto">Auto lyrics</option>');
    expect(html).toContain('<option value="instrumental">Instrumental</option>');
    expect(html).toContain("Style");
    expect(html).toContain('<option value="rock" selected="">Rock</option>');
    expect(html).toContain('<option value="jazz">Jazz</option>');
    expect(html).toContain('<option value="female" selected="">Female</option>');
  });

  it("shows preset styles and vocal selection in automatic mode", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="audio"
        config={{ model: "suno-v5", mode: "auto", style: "folk", vocal: "male" }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="folk" selected="">Folk</option>');
    expect(html).toContain('<option value="male" selected="">Male</option>');
  });

  it("shows style but hides vocal in instrumental mode", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="audio"
        config={{ model: "suno-v5", mode: "instrumental", style: "classical" }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="instrumental" selected="">Instrumental</option>');
    expect(html).toContain('<option value="classical" selected="">Classical</option>');
    expect(html).not.toContain("Vocal");
  });
});
