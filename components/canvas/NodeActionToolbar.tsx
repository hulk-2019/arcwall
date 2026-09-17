"use client";

import { Copy, Eye, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO } from "@/types/canvas";
import { NODE_WIDTH } from "./node-size";

const TOOLBAR_GAP = 10;

/**
 * 选中节点上方的操作浮框：预览 / 复制 / 删除。
 * 预览是节点媒体的唯一大图入口（节点内缩略图不再响应点击）。
 */
export function NodeActionToolbar({ node }: { node: CanvasNodeDTO }) {
  const t = useTranslations("canvas");
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const openMediaPreview = useCanvasStore((s) => s.openMediaPreview);

  const urls = node.output?.urls ?? [];
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
            })
          }
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
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
