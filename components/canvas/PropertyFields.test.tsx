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
  modeSong: "Song",
  modeMusic: "Music",
  vocalAuto: "Auto",
  vocalMale: "Male",
  vocalFemale: "Female",
  voice: "Voice",
  speed: "Speed",
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
