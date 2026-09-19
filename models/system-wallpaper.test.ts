import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { formatSystemWallpaper } from "./system-wallpaper";

describe("formatSystemWallpaper", () => {
  it("keeps media_type so the homepage can play video and audio", () => {
    const wallpaper = formatSystemWallpaper({
      id: 8,
      img_description: "夜巷",
      media_type: "video",
    });
    expect(wallpaper.media_type).toBe("video");
  });
});
