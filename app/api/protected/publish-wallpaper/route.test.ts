import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuthOrResponse: vi.fn(),
  findUserByEmail: vi.fn(),
  findMany: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAuthOrResponse: mocks.requireAuthOrResponse }));
vi.mock("@/models/user", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    wallpapers: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
    system_wallpapers: { createMany: mocks.createMany },
    $transaction: mocks.transaction,
  },
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuthOrResponse.mockResolvedValue({ email: "owner@example.com" });
  mocks.findUserByEmail.mockResolvedValue({ id: 7 });
  mocks.transaction.mockResolvedValue([]);
});

describe("POST /publish-wallpaper", () => {
  it("publishes image, video, and audio works to the homepage", async () => {
    mocks.findMany.mockResolvedValue([
      { id: 1, media_type: "image", img_description: "图", img_path: "wallpapers/a.jpg", is_public: false },
      { id: 2, media_type: "video", img_description: "视频", img_path: "wallpapers/b.mp4", is_public: false },
      { id: 3, media_type: "audio", img_description: "音频", img_path: "wallpapers/c.mp3", is_public: false },
    ]);

    const response = await POST(
      new Request("http://localhost/api/protected/publish-wallpaper", {
        method: "POST",
        body: JSON.stringify({ wallpaperIds: [1, 2, 3] }),
      })
    );

    expect(await response.json()).toEqual({
      code: 0,
      message: "ok",
      data: { success: true, count: 3 },
    });
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ wallpaper_id: 1, media_type: "image" }),
        expect.objectContaining({ wallpaper_id: 2, media_type: "video" }),
        expect.objectContaining({ wallpaper_id: 3, media_type: "audio" }),
      ]),
    });
  });
});
