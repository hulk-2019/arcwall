import { describe, expect, it } from "vitest";
import { buildImageGenerateParams } from "./model-config";

describe("buildImageGenerateParams", () => {
  it("builds gpt-image-2 params with a 16-multiple size for all wallpaper ratios", () => {
    const params = buildImageGenerateParams("gpt-image-2", "a cat", "16:9");

    expect(params?.model).toBe("gpt-image-2");
    expect(params?.prompt).toBe("a cat");
    expect(params?.aspectRatio).toBe("16:9");
    expect(params?.size).toBe("1024x576");
  });

  it("builds gemini params with the selected aspect ratio", () => {
    const params = buildImageGenerateParams(
      "gemini-3.1-flash-image-preview",
      "a forest",
      "9:16",
    );

    expect(params?.model).toBe("gemini-3.1-flash-image-preview");
    expect(params?.aspectRatio).toBe("9:16");
  });

  it("still builds doubao seedream params", () => {
    const params = buildImageGenerateParams("doubao-seedream-4-5-251128", "a city", "1:1");

    expect(params?.model).toBe("doubao-seedream-4-5-251128");
    expect(params?.size).toBe("2048x2048");
  });
});
