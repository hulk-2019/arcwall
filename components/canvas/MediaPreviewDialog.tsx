"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/useCanvasStore";
import {
  findActiveLyricLine,
  timedWordsToLines,
  type TimedLyricLine,
} from "@/lib/audio-lyrics";
import { AudioDiscPlayer } from "@/components/ui/audio-disc-player";
import { cn } from "@/lib/utils";

const LYRIC_WINDOW = 5;

function lyricWindow(lines: TimedLyricLine[], activeIndex: number) {
  if (lines.length <= LYRIC_WINDOW) return { start: 0, items: lines };
  const start = Math.max(
    0,
    Math.min(Math.max(activeIndex, 0) - 2, lines.length - LYRIC_WINDOW)
  );
  return { start, items: lines.slice(start, start + LYRIC_WINDOW) };
}

/**
 * 媒体预览弹窗：图片灯箱（多图可切换）、视频 / 音频播放。
 */
export function MediaPreviewDialog() {
  const t = useTranslations("canvas");
  const preview = useCanvasStore((s) => s.mediaPreview);
  const closeMediaPreview = useCanvasStore((s) => s.closeMediaPreview);
  const cycleMediaPreview = useCanvasStore((s) => s.cycleMediaPreview);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const lyricLines = useMemo(
    () => timedWordsToLines(preview?.timedWords ?? []),
    [preview?.timedWords]
  );
  const activeLyricIndex = findActiveLyricLine(lyricLines, currentTimeMs);

  if (!preview) return null;
  const url = preview.urls[preview.index] ?? preview.urls[0];
  const multi = preview.urls.length > 1;
  const isAudio = preview.kind === "audio";

  return (
    <Dialog open onOpenChange={(open) => !open && closeMediaPreview()}>
      <DialogContent
        className={cn(
          "max-w-3xl sm:rounded-xl",
          isAudio && "max-w-[min(96vw,52rem)] border-none bg-black p-0 text-white sm:rounded-2xl"
        )}
      >
        <DialogHeader className={isAudio ? "sr-only" : undefined}>
          <DialogTitle className="pr-8 text-sm">
            {preview.title || t(preview.kind === "image" ? "nodeTypes.image" : preview.kind === "video" ? "nodeTypes.video" : "nodeTypes.audio")}
            {multi && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {preview.index + 1} / {preview.urls.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("preview")}</DialogDescription>
        </DialogHeader>

        <div
          className={
            isAudio
              ? "relative min-h-[70vh]"
              : "relative flex min-h-0 items-center justify-center"
          }
        >
          {multi && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-0 z-10 h-8 w-8 rounded-full"
              aria-label={t("prevMedia")}
              onClick={() => cycleMediaPreview(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}

          {preview.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={preview.title || ""}
              className="max-h-[70vh] w-full rounded-md object-contain"
            />
          )}
          {preview.kind === "video" && (
            <video src={url} controls autoPlay className="max-h-[70vh] w-full rounded-md bg-black" />
          )}
          {isAudio && (
            <AudioDiscPlayer
              src={url}
              title={preview.title}
              autoPlay
              size="lg"
              audioRef={audioRef}
              onTimeUpdate={setCurrentTimeMs}
              className="min-h-[70vh]"
            >
              <DiscLyrics
                label={t("lyrics")}
                lines={lyricLines}
                fallback={preview.lyrics}
                activeIndex={activeLyricIndex}
                onSeek={(ms) => {
                  if (!audioRef.current) return;
                  audioRef.current.currentTime = ms / 1000;
                  void audioRef.current.play();
                }}
              />
            </AudioDiscPlayer>
          )}

          {multi && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-0 z-10 h-8 w-8 rounded-full"
              aria-label={t("nextMedia")}
              onClick={() => cycleMediaPreview(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

function DiscLyrics({
  label,
  lines,
  fallback,
  activeIndex,
  onSeek,
}: {
  label: string;
  lines: TimedLyricLine[];
  fallback?: string;
  activeIndex: number;
  onSeek: (ms: number) => void;
}) {
  const timed = lyricWindow(lines, activeIndex);
  const untimed =
    lines.length === 0
      ? (fallback ?? "")
          .split(/\r?\n/)
          .map((text) => text.trim())
          .filter(Boolean)
          .slice(0, LYRIC_WINDOW)
      : [];
  const items = timed.items.length
    ? timed.items.map((line, index) => ({
        key: `${line.startMs}-${index}`,
        text: line.text,
        active: timed.start + index === activeIndex,
        startMs: line.startMs,
      }))
    : untimed.map((text, index) => ({
        key: `${text}-${index}`,
        text,
        active: false,
        startMs: undefined as number | undefined,
      }));

  if (items.length === 0) return null;

  return (
    <div className="space-y-2" aria-label={label}>
      {items.map((item) =>
        item.startMs == null ? (
          <p key={item.key} className="text-sm leading-6 text-white/55">
            {item.text}
          </p>
        ) : (
          <button
            type="button"
            key={item.key}
            className={cn(
              "block w-full text-sm leading-6 transition-colors",
              item.active ? "text-white" : "text-white/45 hover:text-white/75"
            )}
            onClick={(event) => {
              event.stopPropagation();
              onSeek(item.startMs!);
            }}
          >
            {item.text}
          </button>
        )
      )}
    </div>
  );
}
