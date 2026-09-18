import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import NodeID3 from "node-id3";
import { buildSongPackage, embedLyricsInMp3 } from "./audio-download";

const timedWords = [
  { text: "灯火沿着河流\n", startMs: 500, endMs: 2200, confidence: 0.98 },
  { text: "晚风轻轻吹\n", startMs: 3000, endMs: 4400, confidence: 0.96 },
];

describe("audio lyric downloads", () => {
  it("embeds title, USLT and SYLT frames into an MP3 buffer", () => {
    const source = Buffer.from([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);

    const tagged = embedLyricsInMp3(source, "夜行", "灯火沿着河流\n晚风轻轻吹", timedWords);
    const tags = NodeID3.read(tagged);

    expect(tags.title).toBe("夜行");
    expect(tags.unsynchronisedLyrics?.text).toBe("灯火沿着河流\n晚风轻轻吹");
    expect(tags.synchronisedLyrics?.[0]?.synchronisedText).toEqual([
      { text: "灯火沿着河流", timeStamp: 500 },
      { text: "晚风轻轻吹", timeStamp: 3000 },
    ]);
  });

  it("builds a package containing matching MP3, LRC and TXT filenames", async () => {
    const source = Buffer.from([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);

    const archive = await buildSongPackage(
      source,
      '夜行: "城市"',
      "灯火沿着河流\n晚风轻轻吹",
      timedWords
    );
    const zip = await JSZip.loadAsync(archive);

    expect(Object.keys(zip.files).sort()).toEqual([
      "夜行_ _城市_.lrc",
      "夜行_ _城市_.mp3",
      "夜行_ _城市_.txt",
    ]);
    expect(await zip.file("夜行_ _城市_.lrc")?.async("string")).toContain(
      "[00:00.50]灯火沿着河流"
    );
    expect(await zip.file("夜行_ _城市_.txt")?.async("string")).toBe(
      "灯火沿着河流\n晚风轻轻吹"
    );
  });
});
