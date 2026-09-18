import { describe, expect, it } from "vitest";
import { buildImageGenerateParams } from "./model-config";

describe("buildImageGenerateParams", () => {
  it("builds gpt-image-2 params with a 16-multiple size for all wallpaper ratios", () => {
    const params = buildImageGenerateParams("gpt-image-2", "a cat", "16:9", { resolution: "1k" });

    expect(params?.model).toBe("gpt-image-2");
    expect(params?.prompt).toBe("a cat");
    expect(params?.aspectRatio).toBe("16:9");
    expect(params?.size).toBe("1024x576");
    expect(params?.resolution).toBe("1k");
  });

  it("scales gpt-image-2 to 2K when resolution is selected", () => {
    const params = buildImageGenerateParams("gpt-image-2", "a cat", "16:9", { resolution: "2k" });

    expect(params?.size).toBe("2048x1152");
    expect(params?.resolution).toBe("2k");
  });

  it("builds gemini params with the selected aspect ratio and size", () => {
    const params = buildImageGenerateParams(
      "gemini-3.1-flash-image-preview",
      "a forest",
      "9:16",
      { resolution: "2k" },
    );

    expect(params?.model).toBe("gemini-3.1-flash-image-preview");
    expect(params?.aspectRatio).toBe("9:16");
    expect(params?.resolution).toBe("2k");
    expect(params?.size).toBe("1152x2048");
  });

  it("still builds doubao seedream params at 2K by default", () => {
    const params = buildImageGenerateParams("doubao-seedream-4-5-251128", "a city", "1:1");

    expect(params?.model).toBe("doubao-seedream-4-5-251128");
    expect(params?.size).toBe("2048x2048");
    expect(params?.resolution).toBe("2k");
  });

  it("scales seedream pixel size down for 1K", () => {
    const params = buildImageGenerateParams("doubao-seedream-4-5-251128", "a city", "16:9", {
      resolution: "1k",
    });

    expect(params?.size).toBe("1424x800");
    expect(params?.resolution).toBe("1k");
  });
});
