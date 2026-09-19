import { describe, expect, it } from "vitest";
import { isPublishableWallpaper, wallpaperMediaType } from "./wallpaper-media";

describe("wallpaperMediaType", () => {
  it("treats missing media_type as image", () => {
    expect(wallpaperMediaType({})).toBe("image");
  });

  it("returns video and audio as-is", () => {
    expect(wallpaperMediaType({ media_type: "video" })).toBe("video");
    expect(wallpaperMediaType({ media_type: "audio" })).toBe("audio");
  });
});

describe("isPublishableWallpaper", () => {
  it("allows succeeded unpublished image, video, and audio works", () => {
    expect(isPublishableWallpaper({ media_type: "image", status: 1, is_public: false })).toBe(true);
    expect(isPublishableWallpaper({ media_type: "video", status: 1, is_public: false })).toBe(true);
    expect(isPublishableWallpaper({ media_type: "audio", status: 1, is_public: false })).toBe(true);
    expect(isPublishableWallpaper({ media_type: "image", status: 1, is_public: true })).toBe(false);
    expect(isPublishableWallpaper({ media_type: "video", status: 0, is_public: false })).toBe(false);
  });
});
