import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSignedUrl: vi.fn(),
}));

vi.mock("@/lib/oss", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import { addThumbnailUrlToWallpaper } from "./wallpaper-utils";

describe("addThumbnailUrlToWallpaper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSignedUrl.mockImplementation(async (path: string) => `https://oss.test/${path}`);
  });

  it("signs the original file for video and audio that have no thumbnail", async () => {
    const video = await addThumbnailUrlToWallpaper({
      img_description: "夜巷",
      model_name: "seedance",
      created_at: "",
      media_type: "video",
      img_path: "wallpapers/clip.mp4",
    });

    expect(video.img_url).toBe("https://oss.test/wallpapers/clip.mp4");
    expect(mocks.getSignedUrl).toHaveBeenCalledWith("wallpapers/clip.mp4", 86400);
  });
});
