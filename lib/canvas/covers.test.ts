import { describe, expect, it } from "vitest";
import { collectCoverTiles } from "./covers";

describe("collectCoverTiles", () => {
  it("collects image and video storage keys in node order", () => {
    expect(
      collectCoverTiles([
        { type: "text", output: { kind: "text", storageKeys: [] } },
        {
          type: "image",
          output: { kind: "image", storageKeys: ["img-a.png", "img-b.png"] },
        },
        {
          type: "video",
          output: { kind: "video", storageKeys: ["clip.mp4"] },
        },
      ]),
    ).toEqual([
      { kind: "image", storageKey: "img-a.png" },
      { kind: "image", storageKey: "img-b.png" },
      { kind: "video", storageKey: "clip.mp4" },
    ]);
  });

  it("includes uploaded images and videos but skips audio", () => {
    expect(
      collectCoverTiles([
        { type: "upload", config: { storageKey: "ref.jpg", mediaType: "image" } },
        { type: "upload", config: { storageKey: "song.mp3", mediaType: "audio" } },
        { type: "upload", config: { storageKey: "take.mp4", mediaType: "video" } },
      ]),
    ).toEqual([
      { kind: "image", storageKey: "ref.jpg" },
      { kind: "video", storageKey: "take.mp4" },
    ]);
  });

  it("dedupes keys and stops at four tiles", () => {
    expect(
      collectCoverTiles([
        { type: "image", output: { kind: "image", storageKeys: ["a.png", "a.png", "b.png"] } },
        { type: "image", output: { kind: "image", storageKeys: ["c.png", "d.png", "e.png"] } },
      ]),
    ).toEqual([
      { kind: "image", storageKey: "a.png" },
      { kind: "image", storageKey: "b.png" },
      { kind: "image", storageKey: "c.png" },
      { kind: "image", storageKey: "d.png" },
    ]);
  });
});
