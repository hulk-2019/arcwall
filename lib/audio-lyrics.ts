export interface TimedLyricWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TimedLyricLine {
  text: string;
  startMs: number;
  endMs: number;
}

/** 将 Suno 词级 alignment 按换行符聚合为播放器/LRC 使用的行级时间轴。 */
export function timedWordsToLines(words: TimedLyricWord[]): TimedLyricLine[] {
  const lines: TimedLyricLine[] = [];
  let text = "";
  let startMs = 0;
  let endMs = 0;

  const append = (part: string, word: TimedLyricWord) => {
    if (!part) return;
    if (!text) startMs = word.startMs;
    text += part;
    endMs = word.endMs;
  };
  const flush = () => {
    const trimmed = text.trim();
    if (trimmed) lines.push({ text: trimmed, startMs, endMs });
    text = "";
    startMs = 0;
    endMs = 0;
  };

  for (const word of words) {
    const parts = word.text.replace(/\r/g, "").split("\n");
    parts.forEach((part, index) => {
      append(part, word);
      if (index < parts.length - 1) flush();
    });
  }
  flush();
  return lines;
}

export function findActiveLyricLine(
  lines: TimedLyricLine[],
  currentTimeMs: number
): number {
  let active = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].startMs > currentTimeMs) break;
    active = index;
  }
  return active;
}

function lrcTimestamp(milliseconds: number): string {
  const hundredths = Math.max(0, Math.floor(milliseconds / 10));
  const minutes = Math.floor(hundredths / 6000);
  const seconds = Math.floor((hundredths % 6000) / 100);
  const fraction = hundredths % 100;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

export function buildLrc(title: string, words: TimedLyricWord[]): string {
  const lines = timedWordsToLines(words);
  return [
    `[ti:${title.replace(/[\r\n\]]/g, " ").trim()}]`,
    "[re:Arcwall]",
    "",
    ...lines.map((line) => `[${lrcTimestamp(line.startMs)}]${line.text}`),
    "",
  ].join("\n");
}

/** 避免下载文件名包含 macOS/Windows 不支持的字符。 */
export function safeSongFilename(title: string): string {
  const safe = title.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return safe.slice(0, 100) || "song";
}
