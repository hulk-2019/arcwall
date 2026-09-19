"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type AudioDiscPlayerProps = {
  src?: string;
  title?: string;
  autoPlay?: boolean;
  variant?: "player" | "cover";
  size?: "sm" | "md" | "lg";
  className?: string;
  children?: ReactNode;
  onTimeUpdate?: (ms: number) => void;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
};

const DISC_SIZE = {
  sm: "h-20 w-20",
  md: "h-28 w-28",
  lg: "h-[min(72vw,28rem)] w-[min(72vw,28rem)]",
};

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function VinylGrooves() {
  const rings = Array.from({ length: 34 }, (_, index) => 16.4 + index * 0.96);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" data-film-disc aria-hidden>
      <circle cx="50" cy="50" r="50" className="fill-zinc-950" />
      {rings.map((radius) => (
        <circle
          key={radius}
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          className="stroke-white/[0.08]"
          strokeWidth="0.32"
        />
      ))}
    </svg>
  );
}

export function AudioDiscPlayer({
  src,
  title,
  autoPlay = false,
  variant = "player",
  size = "md",
  className,
  children,
  onTimeUpdate,
  audioRef,
}: AudioDiscPlayerProps) {
  const t = useTranslations("audioPlayer");
  const innerRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [volume, setVolume] = useState(1);
  const isCover = variant === "cover";
  const compact = !isCover && size === "sm";

  function audioElement() {
    return audioRef?.current ?? innerRef.current;
  }

  function assignAudio(node: HTMLAudioElement | null) {
    innerRef.current = node;
    if (audioRef) audioRef.current = node;
  }

  useEffect(() => {
    if (isCover || !autoPlay) return;
    const audio = audioElement();
    if (!audio) return;
    void audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [autoPlay, isCover, src]);

  async function togglePlayback() {
    const audio = audioElement();
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    await audio.play();
    setPlaying(true);
  }

  async function replay() {
    const audio = audioElement();
    if (!audio) return;
    audio.currentTime = 0;
    setCurrent(0);
    await audio.play();
    setPlaying(true);
  }

  function changeVolume(next: number) {
    const audio = audioElement();
    if (audio) audio.volume = next;
    setVolume(next);
  }

  return (
    <div
      data-audio-disc-player
      className={cn(
        "flex h-full w-full min-h-0 flex-col items-center justify-center overflow-hidden bg-black",
        isCover ? "pointer-events-none p-3" : compact ? "gap-1 p-1.5" : "gap-4 p-6",
        className
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className={cn(
          "relative",
          compact ? "min-h-0 w-14 max-h-14 flex-1 aspect-square" : DISC_SIZE[size]
        )}
      >
        <div
          className={cn(
            "h-full w-full overflow-hidden rounded-full shadow-[0_0_60px_rgb(0_0_0/0.55)] motion-safe:animate-disc-spin",
            playing ? "[animation-play-state:running]" : "[animation-play-state:paused]"
          )}
        >
          <VinylGrooves />
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-black/50" />
        </div>
        <div className="pointer-events-none absolute inset-[31%] rounded-full bg-red-950 shadow-[inset_0_0_18px_rgb(0_0_0/0.45)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black" />
        {children && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto w-[54%] max-h-[58%] overflow-hidden text-center">
              {children}
            </div>
          </div>
        )}
      </div>

      {!isCover && src && (
        <>
          <audio
            ref={assignAudio}
            src={src}
            preload="metadata"
            className="sr-only"
            aria-label={title}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onLoadedMetadata={(event) => {
              setDuration(event.currentTarget.duration || 0);
              event.currentTarget.volume = volume;
            }}
            onTimeUpdate={(event) => {
              setCurrent(event.currentTarget.currentTime);
              onTimeUpdate?.(Math.round(event.currentTarget.currentTime * 1000));
            }}
          />
          <div
            className={cn(
              "flex w-full flex-col items-center",
              compact ? "gap-1 px-1" : "max-w-xl gap-3 px-4"
            )}
          >
            <div
              data-audio-seek
              className={cn(
                "flex w-full items-center gap-2 tabular-nums text-white/50",
                compact ? "text-[10px]" : "text-[11px]"
              )}
            >
              <span className="w-8 shrink-0">{formatClock(current)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={current}
                aria-label={title}
                className="h-1 flex-1 cursor-pointer accent-white"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const audio = audioElement();
                  if (audio) audio.currentTime = next;
                  setCurrent(next);
                }}
              />
              <span className="w-8 shrink-0 text-right">{formatClock(duration)}</span>
            </div>
            <div
              data-audio-transport
              className={cn(
                "grid w-full grid-cols-[1fr_auto_1fr] items-center",
                compact ? "gap-x-4" : "gap-x-16"
              )}
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-white/80 transition-colors hover:text-white"
                  aria-label={t("replay")}
                  onClick={() => void replay()}
                >
                  <RotateCcw className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center rounded-full bg-[#1a73e8] text-white shadow-[0_2px_8px_rgb(26_115_232/0.45)] transition-colors hover:bg-[#1967d2]",
                  compact ? "h-7 w-7" : "h-11 w-11"
                )}
                aria-label={playing ? t("pause") : t("play")}
                onClick={() => void togglePlayback()}
              >
                {playing ? (
                  <Pause className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} fill="currentColor" />
                ) : (
                  <Play
                    className={cn(compact ? "h-3.5 w-3.5" : "ml-0.5 h-5 w-5")}
                    fill="currentColor"
                  />
                )}
              </button>
              <div className="flex items-center gap-1.5">
                <Volume2
                  className={cn(
                    "shrink-0 text-white/80",
                    compact ? "h-3.5 w-3.5" : "h-5 w-5"
                  )}
                  aria-hidden
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  aria-label={t("volume")}
                  className={cn(
                    "h-1 cursor-pointer accent-white",
                    compact ? "w-10" : "w-16"
                  )}
                  onChange={(event) => changeVolume(Number(event.target.value))}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
