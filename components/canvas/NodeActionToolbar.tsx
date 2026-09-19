"use client";

import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Copy, Download, Eye, FileArchive, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startIsolatedDownload, withDownloadLock } from "@/lib/canvas/download";
import { prepareCanvasDownload, saveCanvasMediaToWorkbench } from "@/services/api";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO } from "@/types/canvas";
import { NODE_WIDTH } from "./node-size";
import type { TimedLyricWord } from "@/lib/audio-lyrics";

const TOOLBAR_GAP = 10;

/**
 * 选中节点上方的操作浮框：预览 / 保存至工作台 / 下载 / 复制 / 删除。
 * 预览是节点媒体的唯一大图入口（节点内缩略图不再响应点击）。
 */
export function NodeActionToolbar({ node }: { node: CanvasNodeDTO }) {
  const t = useTranslations("canvas");
  const canvasId = useCanvasStore((s) => s.canvasId);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const openMediaPreview = useCanvasStore((s) => s.openMediaPreview);
  const downloadLock = useRef(false);
  const downloadAbort = useRef<AbortController | null>(null);
  const saveLock = useRef(false);
  const mounted = useRef(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      downloadAbort.current?.abort();
    };
  }, [node.id]);

  const urls = node.output?.urls ?? [];
  const lyrics =
    typeof node.output?.meta?.lyrics === "string" ? node.output.meta.lyrics : undefined;
  const timedWords = Array.isArray(node.output?.meta?.timedWords)
    ? (node.output.meta.timedWords as TimedLyricWord[])
    : undefined;
  const previewKind =
    node.type === "video"
      ? "video"
      : node.type === "audio"
        ? "audio"
        : node.type === "upload"
          ? node.config.mediaType === "video"
            ? "video"
            : node.config.mediaType === "audio"
              ? "audio"
              : "image"
          : node.type === "image"
            ? "image"
            : null;
  const canDownload = Boolean(canvasId && previewKind && urls.length > 0);
  const canSaveToWorkbench = canDownload;
  const canDownloadLyrics = node.type === "audio" && Boolean(lyrics);

  async function download(endpoint: string, key: string) {
    await withDownloadLock(downloadLock, async () => {
      setDownloading(key);
      const controller = new AbortController();
      downloadAbort.current = controller;
      try {
        const url = await prepareCanvasDownload(endpoint, controller.signal);
        startIsolatedDownload(url);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast.error(t("downloadFailed"));
        }
      } finally {
        downloadAbort.current = null;
        if (mounted.current) setDownloading(null);
      }
    });
  }

  async function saveToWorkbench() {
    if (!canvasId || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      const result = await saveCanvasMediaToWorkbench({ canvasId, nodeId: node.id });
      if (result.code !== 0) {
        toast.error(result.message || t("saveToWorkbenchFailed"));
        return;
      }
      const saved = Number(result.data?.saved ?? 0);
      const alreadySaved = Number(result.data?.alreadySaved ?? 0);
      if (saved > 0) toast.success(t("saveToWorkbenchSuccess"));
      else if (alreadySaved > 0) toast.success(t("saveToWorkbenchAlreadySaved"));
      else toast.error(t("saveToWorkbenchFailed"));
    } catch {
      toast.error(t("saveToWorkbenchFailed"));
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <div
      data-node-toolbar
      className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-full border bg-card/95 p-1 shadow-lg backdrop-blur"
      style={{ left: node.x + NODE_WIDTH / 2, top: node.y - TOOLBAR_GAP }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {previewKind && urls.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          title={t("preview")}
          aria-label={t("preview")}
          onClick={() =>
            openMediaPreview({
              kind: previewKind,
              urls,
              title: node.config.title || node.config.fileName,
              nodeId: node.id,
              ...(node.type === "audio"
                ? { lyrics, timedWords }
                : {}),
            })
          }
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      {canSaveToWorkbench && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
          title={t("saveToWorkbench")}
          aria-label={t("saveToWorkbench")}
          aria-busy={saving}
          disabled={saving}
          onClick={() => void saveToWorkbench()}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BookmarkPlus className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      {canDownload && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
              title={t("download")}
              aria-label={t("download")}
              aria-busy={Boolean(downloading)}
              disabled={Boolean(downloading)}
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {urls.map((_, index) => (
              <DropdownMenuItem
                key={`original-${index}`}
                disabled={Boolean(downloading)}
                onSelect={() =>
                  download(
                    `/api/protected/canvas/download?canvasId=${canvasId}&nodeId=${encodeURIComponent(node.id)}&index=${index}`,
                    `original-${index}`
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {t("downloadOriginal")}
                {urls.length > 1 ? ` ${index + 1}` : ""}
              </DropdownMenuItem>
            ))}
            {canDownloadLyrics && (
              <>
                <DropdownMenuItem
                  disabled={Boolean(downloading)}
                  onSelect={() =>
                    download(
                      `/api/protected/canvas/audio-download?canvasId=${canvasId}&nodeId=${encodeURIComponent(node.id)}&format=mp3`,
                      "lyrics-mp3"
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadLyricsMp3")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={Boolean(downloading)}
                  onSelect={() =>
                    download(
                      `/api/protected/canvas/audio-download?canvasId=${canvasId}&nodeId=${encodeURIComponent(node.id)}&format=zip`,
                      "song-package"
                    )
                  }
                >
                  <FileArchive className="mr-2 h-4 w-4" />
                  {t("downloadSongPackage")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
        title={t("duplicateNode")}
        aria-label={t("duplicateNode")}
        onClick={() => duplicateNode(node.id)}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
        title={t("deleteNode")}
        aria-label={t("deleteNode")}
        onClick={() => deleteNode(node.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
