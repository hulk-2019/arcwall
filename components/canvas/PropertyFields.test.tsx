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
  tags: "Style tags",
  vocalAuto: "Auto",
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
  it("shows custom / auto / instrumental modes and style tags + vocal in custom mode", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="audio"
        config={{ model: "suno-v5", mode: "custom", tags: "pop", vocal: "female" }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="custom" selected="">Custom lyrics</option>');
    expect(html).toContain('<option value="auto">Auto lyrics</option>');
    expect(html).toContain('<option value="instrumental">Instrumental</option>');
    expect(html).toContain("Style tags");
    expect(html).toContain("pop");
    expect(html).toContain('<option value="female" selected="">Female</option>');
  });

  it("hides tags and vocal outside custom mode", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="audio"
        config={{ model: "suno-v5", mode: "instrumental" }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="instrumental" selected="">Instrumental</option>');
    expect(html).not.toContain("Style tags");
    expect(html).not.toContain("Vocal");
  });
});
