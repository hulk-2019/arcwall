import JSZip from "jszip";
import NodeID3 from "node-id3";
import {
  buildLrc,
  safeSongFilename,
  timedWordsToLines,
  type TimedLyricWord,
} from "@/lib/audio-lyrics";

export function embedLyricsInMp3(
  audio: Buffer,
  title: string,
  lyrics: string,
  timedWords: TimedLyricWord[]
): Buffer {
  const lines = timedWordsToLines(timedWords);
  const tagged = NodeID3.write(
    {
      title,
      unsynchronisedLyrics: { language: "und", text: lyrics },
      ...(lines.length
        ? {
            synchronisedLyrics: [
              {
                language: "und",
                timeStampFormat: NodeID3.TagConstants.TimeStampFormat.MILLISECONDS,
                contentType: NodeID3.TagConstants.SynchronisedLyrics.ContentType.LYRICS,
                shortText: title,
                synchronisedText: lines.map((line) => ({
                  text: line.text,
                  timeStamp: Math.max(0, Math.round(line.startMs)),
                })),
              },
            ],
          }
        : {}),
    },
    audio
  );
  if (!Buffer.isBuffer(tagged)) throw new Error("写入 MP3 歌词标签失败");
  return tagged;
}

export async function buildSongPackage(
  audio: Buffer,
  title: string,
  lyrics: string,
  timedWords: TimedLyricWord[]
): Promise<Buffer> {
  const filename = safeSongFilename(title);
  const zip = new JSZip();
  zip.file(`${filename}.mp3`, embedLyricsInMp3(audio, title, lyrics, timedWords), {
    compression: "STORE",
  });
  zip.file(`${filename}.lrc`, buildLrc(title, timedWords));
  zip.file(`${filename}.txt`, lyrics);
  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
