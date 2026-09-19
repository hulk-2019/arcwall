import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(), set: vi.fn() } }));

import { formatWallpaper } from "./wallpaper";

describe("formatWallpaper", () => {
  it("includes media_type for workbench cards", () => {
    const wallpaper = formatWallpaper({
      id: 21,
      img_description: "夜巷",
      media_type: "video",
      status: 1,
      is_public: false,
    });
    expect(wallpaper.media_type).toBe("video");
  });
});
