"use client";

import { ChevronLeft, ChevronRight, Download } from "lucide-react";
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

/**
 * 媒体预览弹窗：图片灯箱（多图可切换）、视频 / 音频播放，支持下载。
 * 链接为读取时签名的 OSS URL，直接 <a download> 下载。
 */
export function MediaPreviewDialog() {
  const t = useTranslations("canvas");
  const preview = useCanvasStore((s) => s.mediaPreview);
  const closeMediaPreview = useCanvasStore((s) => s.closeMediaPreview);
  const cycleMediaPreview = useCanvasStore((s) => s.cycleMediaPreview);

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

        <div className="relative flex min-h-0 items-center justify-center">
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
            <audio src={url} controls autoPlay className="w-full" />
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

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={url} download target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("download")}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
