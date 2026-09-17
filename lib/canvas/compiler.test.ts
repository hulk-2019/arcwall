import { describe, expect, it } from "vitest";
import type { CanvasNodeOutput } from "@/types/canvas";
import { buildVideoPrompt, compileInputs } from "./compiler";

const EMPTY_MEDIA_REFERENCES: Array<[string, CanvasNodeOutput]> = [
  ["reference_images", { kind: "image", storageKeys: [] }],
  ["first_frame", { kind: "image", storageKeys: [] }],
  ["reference_audio", { kind: "audio", storageKeys: [] }],
];

describe("canvas input compiler", () => {
  it("includes storyboard motion text only once in a video prompt", () => {
    const storyboard: CanvasNodeOutput = {
      kind: "storyboard",
      storyboard: {
        title: "Trip",
        shots: [{ index: 1, subject_action: "walk" }],
      },
    };
    const compiled = compileInputs(
      [{ sourceNodeId: "storyboard-node", targetNodeId: "video-node", targetPort: "prompt" }],
      new Map([["storyboard-node", storyboard]])
    );

    expect(buildVideoPrompt({ prompt: "slow camera move" }, compiled)).toBe(
      "《Trip》\n镜头1，walk\n\nslow camera move"
    );
  });

  it.each(EMPTY_MEDIA_REFERENCES)("marks an empty %s media reference as missing", (targetPort, output) => {
    const compiled = compileInputs(
      [{ sourceNodeId: "empty-upload", targetNodeId: "target-node", targetPort }],
      new Map<string, CanvasNodeOutput>([["empty-upload", output]])
    );

    expect(compiled.missingNodeIds).toEqual(["empty-upload"]);
  });
});
