import { describe, expect, it } from "vitest";
import { GenWallpaperSchema } from "./schemas";

describe("GenWallpaperSchema", () => {
  it("accepts 1k/2k resolution for homepage and workbench generation", () => {
    const parsed = GenWallpaperSchema.parse({
      description: "a city",
      aspectRatio: "16:9",
      model: "doubao-seedream-4-5-251128",
      resolution: "1k",
    });

    expect(parsed.resolution).toBe("1k");
  });
});
