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
  videoReferenceFirstFrame: "First frame",
  videoReferenceMultimodal: "Multimodal reference",
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
  it("allows switching between first-frame and multimodal modes when an image is connected", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="video"
        config={{
          model: "video-model",
          videoMode: "text",
          videoReferenceMode: "multimodal",
        }}
        hasVideoImageReference
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="first_frame">First frame</option>');
    expect(html).toContain(
      '<option value="multimodal" selected="">Multimodal reference</option>'
    );
    expect(html).not.toMatch(/<select[^>]*disabled=""/);
  });

  it("hides 3s and 1080p for Seedance 2.0", () => {
    const html = renderToStaticMarkup(
      <PropertyFields
        type="video"
        config={{
          model: "doubao-seedance-2-0-fast-260128",
          duration: 3,
          resolution: "1080p",
        }}
        labels={labels}
        onPatch={vi.fn()}
        onDiscrete={vi.fn()}
        onBeginEdit={vi.fn()}
      />
    );

    expect(html).toContain('<option value="4" selected="">4s</option>');
    expect(html).toContain('<option value="15">15s</option>');
    expect(html).not.toContain('value="3"');
    expect(html).toContain('<option value="720p" selected="">720p</option>');
    expect(html).not.toContain('value="1080p"');
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
