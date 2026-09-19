import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  findFirst: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallpapers: { findFirst: mocks.findFirst },
    system_wallpapers: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/oss", () => ({ getSignedUrl: mocks.getSignedUrl }));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.getSignedUrl.mockResolvedValue("https://oss.test/signed");
});

describe("POST /wallpaper-urls", () => {
  it("falls back to the original file when preview has no watermark", async () => {
    mocks.findFirst.mockResolvedValue({
      id: 21,
      img_path: "wallpapers/clip.mp4",
      img_watermark_path: null,
      media_type: "video",
    });

    const response = await POST(
      new Request("http://localhost/api/protected/wallpaper-urls", {
        method: "POST",
        body: JSON.stringify({ wallpaperId: 21, type: "preview" }),
      })
    );

    expect(await response.json()).toEqual({
      code: 0,
      message: "ok",
      data: { url: "https://oss.test/signed" },
    });
    expect(mocks.getSignedUrl).toHaveBeenCalledWith("wallpapers/clip.mp4", 86400);
  });
});
