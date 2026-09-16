"use client";

import { useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO, CanvasNodeOutput } from "@/types/canvas";
import { NODE_TYPE_ACCENT, NODE_TYPE_TONE, NodeTypeIcon, STATUS_BADGE } from "./node-meta";
import { NODE_HEIGHT, NODE_WIDTH } from "./node-size";

export { NODE_HEIGHT, NODE_WIDTH };

interface NodeCardProps {
  node: CanvasNodeDTO;
  selected: boolean;
  scale: number;
  connectTarget: boolean;
}

export function NodeCard({ node, selected, scale, connectTarget }: NodeCardProps) {
  const moveNode = useCanvasStore((s) => s.moveNode);
  const select = useCanvasStore((s) => s.select);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const live = useCanvasStore((s) => s.liveExecution);
  const t = useTranslations("canvas");
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(
    null
  );

  // 运行中执行的实时状态覆盖轮询结果（PRD-RUN-003）
  const status = live?.statusByNode?.[node.id] ?? node.status;
  const output = live?.outputs?.[node.id] ?? node.output;
  const error = live?.errors?.[node.id] ?? node.error;

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-node-action]")) return;
    event.stopPropagation();
    select(node.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = (event.clientX - dragRef.current.startX) / scale;
    const dy = (event.clientY - dragRef.current.startY) / scale;
    moveNode(
      node.id,
      Math.round(dragRef.current.nodeX + dx),
      Math.round(dragRef.current.nodeY + dy),
      false
    );
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const current = useCanvasStore.getState().nodes.find((item) => item.id === node.id);
    if (current) moveNode(node.id, current.x, current.y, true);
  };

  const isRunning = status === "running" || status === "queued" || status === "pending";

  return (
    <article
      data-node-id={node.id}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        "absolute cursor-grab overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg transition-shadow active:cursor-grabbing",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
        connectTarget && "border-success ring-2 ring-success/40",
        status === "failed" && "border-destructive/70"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        zIndex: selected ? 10 : 1,
      }}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", NODE_TYPE_ACCENT[node.type])} />

      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 pl-4">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            NODE_TYPE_TONE[node.type]
          )}
        >
          <NodeTypeIcon type={node.type} className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 truncate text-sm font-medium">
          {node.config.title || t(`nodeTypes.${node.type}`)}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-node-action="delete"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          title={t("deleteNode")}
          aria-label={t("deleteNode")}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            deleteNode(node.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1 px-4">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_BADGE[status] || STATUS_BADGE.idle
          )}
        >
          {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
          {t(`status.${status || "idle"}`)}
        </span>
      </div>

      <div className="mt-2 overflow-hidden px-4 text-xs text-muted-foreground">
        <NodePreview node={node} output={output} />
      </div>

      {error && (
        <p className="absolute inset-x-4 bottom-2 truncate text-[10px] text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}

function NodePreview({ node, output }: { node: CanvasNodeDTO; output?: CanvasNodeOutput }) {
  const t = useTranslations("canvas");

  if (node.type === "text") {
    return (
      <p className="line-clamp-4 whitespace-pre-wrap">
        {node.config.text || t("noPreview")}
      </p>
    );
  }

  if (node.type === "upload") {
    const mediaType = node.config.mediaType;
    return (
      <>
        <p className="line-clamp-2">{node.config.fileName || t("noFile")}</p>
        {output?.urls?.[0] && mediaType === "video" ? (
          <video
            src={output.urls[0]}
            className="mt-1.5 h-16 w-full rounded-md object-cover"
            muted
          />
        ) : output?.urls?.[0] && mediaType === "audio" ? (
          <audio src={output.urls[0]} controls className="mt-1.5 h-8 w-full" />
        ) : output?.urls?.[0] ? (
          <img
            src={output.urls[0]}
            alt=""
            className="mt-1.5 h-16 w-full rounded-md object-cover"
          />
        ) : null}
      </>
    );
  }

  if (node.type === "audio") {
    return (
      <>
        <p className="line-clamp-2">{node.config.text || t("noPreview")}</p>
        {output?.urls?.[0] ? <audio src={output.urls[0]} controls className="mt-1.5 h-8 w-full" /> : null}
      </>
    );
  }

  if (node.type === "image") {
    return (
      <>
        <p className="line-clamp-2">{node.config.prompt || t("noPreview")}</p>
        {output?.urls?.[0] ? (
          <img
            src={output.urls[0]}
            alt=""
            className="mt-1.5 h-16 w-full rounded-md object-cover"
          />
        ) : null}
      </>
    );
  }

  if (node.type === "storyboard") {
    const shots = output?.storyboard?.shots?.length;
    return (
      <>
        <p className="line-clamp-2">{node.config.brief || t("noPreview")}</p>
        <p className="mt-1.5 text-muted-foreground">
          {shots ? `${shots} ${t("shots")}` : t("shotsPlaceholder")}
        </p>
      </>
    );
  }

  return (
    <>
      <p className="line-clamp-2">{node.config.prompt || t("noPreview")}</p>
      {output?.urls?.[0] ? (
        <video
          src={output.urls[0]}
          className="mt-1.5 h-16 w-full rounded-md object-cover"
          muted
        />
      ) : null}
    </>
  );
}
