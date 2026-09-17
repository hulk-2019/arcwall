import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  edit: vi.fn(),
  generate: vi.fn(),
  toFile: vi.fn(),
  axiosGet: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    images = {
      edit: mocks.edit,
      generate: mocks.generate,
    };
  },
  toFile: mocks.toFile,
}));
vi.mock("axios", () => ({
  default: {
    get: mocks.axiosGet,
    post: vi.fn(),
  },
}));
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 640, height: 480, hasAlpha: false }),
  })),
}));
vi.mock("@/lib/oss", () => ({
  internalDownloadHeaders: vi.fn(() => ({ Referer: "https://assets.example.com/" })),
}));

import { generateGptImage } from "./image-proxy";

describe("generateGptImage edits", () => {
  beforeEach(() => {
    vi.stubEnv("PROXY_302AI_API_KEY", "test-key");
    mocks.axiosGet.mockResolvedValue({
      data: Buffer.from("jpeg"),
      headers: { "content-type": "image/jpeg" },
    });
    mocks.toFile.mockResolvedValue({ name: "ref-0.jpg" });
    mocks.edit.mockResolvedValue({
      data: [{ b64_json: Buffer.from("result").toString("base64") }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses the singular image multipart field for one reference", async () => {
    await generateGptImage({
      model: "gpt-image-2",
      prompt: "change the sky",
      size: "1024x1024",
      referenceUrls: ["https://assets.example.com/ref.jpg"],
    });

    expect(mocks.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { name: "ref-0.jpg" },
      })
    );
  });
});
