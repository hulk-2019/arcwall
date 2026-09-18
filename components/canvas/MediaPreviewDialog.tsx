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
} from "@/lib/audio-lyrics";

/**
 * 媒体预览弹窗：图片灯箱（多图可切换）、视频 / 音频播放。
 */
export function MediaPreviewDialog() {
  const t = useTranslations("canvas");
  const preview = useCanvasStore((s) => s.mediaPreview);
  const closeMediaPreview = useCanvasStore((s) => s.closeMediaPreview);
  const cycleMediaPreview = useCanvasStore((s) => s.cycleMediaPreview);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeLyricRef = useRef<HTMLButtonElement>(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const lyricLines = useMemo(
    () => timedWordsToLines(preview?.timedWords ?? []),
    [preview?.timedWords]
  );
  const activeLyricIndex = findActiveLyricLine(lyricLines, currentTimeMs);
  useEffect(() => {
    activeLyricRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLyricIndex]);

  if (!preview) return null;
  const url = preview.urls[preview.index] ?? preview.urls[0];
  const multi = preview.urls.length > 1;

  return (
    <Dialog open onOpenChange={(open) => !open && closeMediaPreview()}>
      <DialogContent className="max-w-3xl sm:rounded-xl">
        <DialogHeader>
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
            preview.kind === "audio"
              ? "relative min-h-0"
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
          {preview.kind === "audio" && (
            <div className="w-full space-y-4">
              <audio
                ref={audioRef}
                src={url}
                controls
                autoPlay
                className="w-full"
                onTimeUpdate={(event) =>
                  setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))
                }
              />
              {preview.lyrics && (
                <div
                  className="max-h-[42vh] overflow-y-auto rounded-lg border bg-muted/30 px-4 py-3 text-center"
                  aria-label={t("lyrics")}
                >
                  {lyricLines.length > 0
                    ? lyricLines.map((line, index) => (
                        <button
                          type="button"
                          key={`${line.startMs}-${index}`}
                          ref={index === activeLyricIndex ? activeLyricRef : undefined}
                          className={`block w-full py-1 text-sm leading-6 transition-colors ${
                            index === activeLyricIndex
                              ? "font-medium text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          onClick={() => {
                            if (!audioRef.current) return;
                            audioRef.current.currentTime = line.startMs / 1000;
                            void audioRef.current.play();
                          }}
                        >
                          {line.text}
                        </button>
                      ))
                    : preview.lyrics.split(/\r?\n/).map((line, index) => (
                        <p key={index} className="py-1 text-sm leading-6 text-muted-foreground">
                          {line || "\u00a0"}
                        </p>
                      ))}
                </div>
              )}
            </div>
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
