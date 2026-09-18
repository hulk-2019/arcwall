import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  generateGptImage: vi.fn(),
  generateGeminiNativeImage: vi.fn(),
  generateGeminiChatImage: vi.fn(),
  isProxyConfigured: vi.fn(() => true),
  gptImageSize: vi.fn(() => "1024x576"),
}));

vi.mock("@/services/openai", () => ({
  getDoubaoAIClient: () => ({
    images: { generate: mocks.generate },
  }),
}));

vi.mock("@/services/image-proxy", () => ({
  isProxyConfigured: mocks.isProxyConfigured,
  generateGptImage: mocks.generateGptImage,
  generateGeminiNativeImage: mocks.generateGeminiNativeImage,
  generateGeminiChatImage: mocks.generateGeminiChatImage,
  gptImageSize: mocks.gptImageSize,
}));

import { generateWallpaperRawImage } from "./wallpaper-image";

describe("generateWallpaperRawImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isProxyConfigured.mockReturnValue(true);
  });

  it("sends gpt-image-2 jobs to the 302 proxy", async () => {
    mocks.generateGptImage.mockResolvedValue(["https://cdn.example/gpt.png"]);

    const url = await generateWallpaperRawImage({
      model: "gpt-image-2",
      prompt: "a cat",
      size: "2048x1152",
      aspectRatio: "16:9",
      resolution: "2k",
    });

    expect(url).toBe("https://cdn.example/gpt.png");
    expect(mocks.generateGptImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-2", prompt: "a cat", size: "2048x1152" }),
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("sends gemini flash jobs with native imageSize", async () => {
    mocks.generateGeminiNativeImage.mockResolvedValue(["https://cdn.example/gemini.png"]);

    const url = await generateWallpaperRawImage({
      model: "gemini-3.1-flash-image-preview",
      prompt: "a forest",
      aspectRatio: "9:16",
      resolution: "2k",
    });

    expect(url).toBe("https://cdn.example/gemini.png");
    expect(mocks.generateGeminiNativeImage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.1-flash-image-preview",
        aspectRatio: "9:16",
        imageSize: "2K",
      }),
    );
  });

  it("hints 1K size in gemini chat prompts", async () => {
    mocks.generateGeminiChatImage.mockResolvedValue(["https://cdn.example/pro.png"]);

    await generateWallpaperRawImage({
      model: "gemini-3-pro-image-preview",
      prompt: "a lake",
      aspectRatio: "1:1",
      resolution: "1k",
    });

    expect(mocks.generateGeminiChatImage).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("1K"),
      }),
    );
  });

  it("keeps seedream jobs on the ark client", async () => {
    mocks.generate.mockResolvedValue({ data: [{ url: "https://cdn.example/ark.png" }] });

    const url = await generateWallpaperRawImage({
      model: "doubao-seedream-4-5-251128",
      prompt: "a city",
      size: "2048x2048",
    });

    expect(url).toBe("https://cdn.example/ark.png");
    expect(mocks.generate).toHaveBeenCalled();
    expect(mocks.generateGptImage).not.toHaveBeenCalled();
  });
});
