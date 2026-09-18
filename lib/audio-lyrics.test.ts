import { describe, expect, it } from "vitest";
import * as audioLyrics from "./audio-lyrics";

const words = [
  { text: "[Verse]\n灯火", startMs: 559, endMs: 1200, confidence: 0.98 },
  { text: "沿着河流\n", startMs: 1200, endMs: 2400, confidence: 0.96 },
  { text: "晚风 ", startMs: 3000, endMs: 3500, confidence: 0.92 },
  { text: "轻轻吹\n", startMs: 3500, endMs: 4300, confidence: 0.9 },
];

describe("timestamped lyric formatting", () => {
  it("groups word alignments into timed lyric lines", () => {
    const lines = (audioLyrics as any).timedWordsToLines(words);

    expect(lines).toEqual([
      { text: "[Verse]", startMs: 559, endMs: 1200 },
      { text: "灯火沿着河流", startMs: 559, endMs: 2400 },
      { text: "晚风 轻轻吹", startMs: 3000, endMs: 4300 },
    ]);
  });

  it("builds UTF-8 LRC with title and line timestamps", () => {
    const lrc = (audioLyrics as any).buildLrc("夜行", words);

    expect(lrc).toBe(
      [
        "[ti:夜行]",
        "[re:Arcwall]",
        "",
        "[00:00.55][Verse]",
        "[00:00.55]灯火沿着河流",
        "[00:03.00]晚风 轻轻吹",
        "",
      ].join("\n")
    );
  });

  it("sanitizes filenames for downloaded song assets", () => {
    expect((audioLyrics as any).safeSongFilename('夜行: "城市"/版本?')).toBe(
      "夜行_ _城市__版本_"
    );
  });

  it("selects the current lyric line from audio playback time", () => {
    const lines = (audioLyrics as any).timedWordsToLines(words);

    expect((audioLyrics as any).findActiveLyricLine(lines, 500)).toBe(-1);
    expect((audioLyrics as any).findActiveLyricLine(lines, 1200)).toBe(1);
    expect((audioLyrics as any).findActiveLyricLine(lines, 3200)).toBe(2);
  });
});
