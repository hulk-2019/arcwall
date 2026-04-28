"use client";

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Wallpaper } from "@/types/wallpaper";
import { ImageWithPlaceholder } from "@/components/ui/image-with-placeholder";
import { Loading } from "@/components/ui/loading";

interface WallpaperPreviewDialogProps {
  wallpaper: Wallpaper | null;
  imageUrl?: string | null;
  onClose: () => void;
  promptLabel: string;
  modelLabel?: string;
  aspectRatioLabel?: string;
  resolutionLabel?: string;
  currentIndex?: number;
  totalCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
  renderActions?: (wallpaper: Wallpaper) => ReactNode;
}

export function WallpaperPreviewDialog({
  wallpaper,
  imageUrl,
  onClose,
  promptLabel,
  modelLabel,
  aspectRatioLabel,
  resolutionLabel,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  renderActions,
}: WallpaperPreviewDialogProps) {
  const [isImageFullscreen, setIsImageFullscreen] = useState(false);

  const previewUrl = useMemo(() => {
    if (!wallpaper) return "";
    return (
      imageUrl ||
      wallpaper.img_watermark_url ||
      wallpaper.img_thumbnail_url ||
      wallpaper.img_url ||
      ""
    );
  }, [wallpaper, imageUrl]);

  const hasNavigation = !!onPrev && !!onNext && (totalCount || 0) > 1;

  const getAspectRatio = useCallback((w: Wallpaper) => {
    if (w.aspect_ratio_name) return w.aspect_ratio_name;
    const parts = w.img_size?.split("x");
    if (!parts || parts.length !== 2) return w.img_size;
    const width = parseInt(parts[0], 10);
    const height = parseInt(parts[1], 10);
    if (!width || !height) return w.img_size;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }, []);

  useEffect(() => {
    if (!wallpaper) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isImageFullscreen) {
          setIsImageFullscreen(false);
        } else {
          onClose();
        }
      }
      if (!isImageFullscreen && e.key === "ArrowLeft" && onPrev) onPrev();
      if (!isImageFullscreen && e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [wallpaper, onClose, onPrev, onNext, isImageFullscreen]);

  useEffect(() => {
    if (wallpaper) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [wallpaper]);

  if (!wallpaper) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-0 md:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="relative w-full h-full md:h-auto md:max-h-[95vh] md:max-w-6xl"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 md:-right-3 md:-top-3 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative flex flex-col md:flex-row w-full h-full md:h-auto md:rounded-2xl overflow-hidden bg-background">
            <div
              className="relative flex-shrink-0 w-full md:w-[68%] bg-black cursor-zoom-in"
              style={{ minHeight: "58vh" }}
              onClick={() => previewUrl && setIsImageFullscreen(true)}
            >
              {previewUrl ? (
                <ImageWithPlaceholder
                  src={previewUrl}
                  alt={wallpaper.img_description}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 68vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loading size="lg" />
                </div>
              )}

              {hasNavigation && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrev();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                    aria-label="Previous"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNext();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
                    aria-label="Next"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {hasNavigation && typeof currentIndex === "number" && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-sm">
                  {currentIndex + 1} / {totalCount}
                </div>
              )}
            </div>

            <div className="flex flex-col flex-1 p-5 md:p-6 gap-4 overflow-y-auto">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  {promptLabel}
                </p>
                <p className="text-sm leading-relaxed text-foreground">
                  {wallpaper.img_description}
                </p>
              </div>

              {modelLabel && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {modelLabel}
                  </p>
                  <p className="text-sm text-foreground">{wallpaper.model_name}</p>
                </div>
              )}

              {aspectRatioLabel && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {aspectRatioLabel}
                  </p>
                  <p className="text-sm text-foreground">{getAspectRatio(wallpaper)}</p>
                </div>
              )}

              {resolutionLabel && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    {resolutionLabel}
                  </p>
                  <p className="text-sm text-foreground">{wallpaper.img_size}</p>
                </div>
              )}

              {renderActions && <div className="mt-auto flex gap-2">{renderActions(wallpaper)}</div>}
            </div>
          </div>
        </div>
      </div>

      {isImageFullscreen && previewUrl && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black cursor-zoom-out"
          onClick={() => setIsImageFullscreen(false)}
        >
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
            onClick={() => setIsImageFullscreen(false)}
          >
            <X className="h-6 w-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={wallpaper.img_description}
            className="max-h-screen max-w-full object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
