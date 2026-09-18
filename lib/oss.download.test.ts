import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signatureUrl: vi.fn(),
  head: vi.fn(),
}));

vi.mock("ali-oss", () => ({
  default: class {
    signatureUrl = mocks.signatureUrl;
    head = mocks.head;
  },
}));

import { getSignedDownloadUrl, objectExists } from "./oss";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OSS_HOST = "static.example.com";
  mocks.signatureUrl.mockReturnValue(
    "http://bucket.oss-cn-shenzhen.aliyuncs.com/canvas/image.png?Signature=abc"
  );
});

describe("getSignedDownloadUrl", () => {
  it("signs Content-Disposition as an attachment and keeps the custom host", () => {
    const url = getSignedDownloadUrl("canvas/image.png", "城市夜景.png", 600);

    expect(mocks.signatureUrl).toHaveBeenCalledWith("canvas/image.png", {
      expires: 600,
      response: {
        "content-disposition":
          "attachment; filename=\"download.png\"; filename*=UTF-8''%E5%9F%8E%E5%B8%82%E5%A4%9C%E6%99%AF.png",
      },
    });
    expect(url).toContain("https://static.example.com/canvas/image.png");
  });
});

describe("objectExists", () => {
  it("returns true when OSS head succeeds", async () => {
    mocks.head.mockResolvedValue({});

    await expect(objectExists("canvas/downloads/file.zip")).resolves.toBe(true);
  });

  it("returns false for a missing object", async () => {
    mocks.head.mockRejectedValue({ code: "NoSuchKey", status: 404 });

    await expect(objectExists("canvas/downloads/missing.zip")).resolves.toBe(false);
  });
});
