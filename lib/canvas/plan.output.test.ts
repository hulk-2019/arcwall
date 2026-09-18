import { describe, expect, it } from "vitest";
import * as plan from "./plan";

describe("applyOutputMetadataToConfig", () => {
  it("uses a successful generated song title as the audio node title", () => {
    const apply = (plan as any).applyOutputMetadataToConfig;
    expect(typeof apply).toBe("function");

    expect(
      apply(
        "audio",
        { title: "音频生成", mode: "auto", text: "城市夜晚" },
        {
          kind: "audio",
          storageKeys: ["canvas/song.mp3"],
          meta: { title: "夜行", lyrics: "[Verse]\n灯火沿着河流" },
        },
        "succeeded"
      )
    ).toEqual({
      title: "夜行",
      mode: "auto",
      text: "城市夜晚",
    });
  });

  it("does not rename failed nodes or non-audio nodes", () => {
    const apply = (plan as any).applyOutputMetadataToConfig;
    const config = { title: "原名称" };
    const output = { kind: "audio", meta: { title: "供应商标题" } };

    expect(apply("audio", config, output, "failed")).toEqual(config);
    expect(apply("video", config, output, "succeeded")).toEqual(config);
  });
});
