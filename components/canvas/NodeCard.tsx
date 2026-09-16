"use client";

import { useRef } from "react";
import { Expand, Loader2, Play, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO, CanvasNodeOutput } from "@/types/canvas";
import { NODE_TYPE_ACCENT, NODE_TYPE_TONE, NodeTypeIcon, STATUS_BADGE } from "./node-meta";
import { NODE_WIDTH, nodeHeight } from "./node-size";

interface NodeCardProps {
  node: CanvasNodeDTO;
  selected: boolean;
  scale: number;
  connectTarget: boolean;
  /** 引用拾取模式：非空时点击节点 = 建立引用连线 */
  pickMode: boolean;
  isPickSource: boolean;
  runDisabled: boolean;
  onRunNode: (nodeId: string) => void;
}

export function NodeCard({
  node,
  selected,
  scale,
  connectTarget,
  pickMode,
  isPickSource,
  runDisabled,
  onRunNode,
}: NodeCardProps) {
  const moveNode = useCanvasStore((s) => s.moveNode);
  const select = useCanvasStore((s) => s.select);
  const deleteNode = useCanvasStore((s) => s.deleteNode);
  const connectNodes = useCanvasStore((s) => s.connectNodes);
  const live = useCanvasStore((s) => s.liveExecution);
  const t = useTranslations("canvas");
  const dragRef = useRef<{ startX: number; startY: number; nodeX: number; nodeY: number } | null>(
    null
  );

  // 运行中执行的实时状态覆盖轮询结果（PRD-RUN-003）
  const status = live?.statusByNode?.[node.id] ?? node.status;
  const output = live?.outputs?.[node.id] ?? node.output;
  const error = live?.errors?.[node.id] ?? node.error;
  const executable = NODE_TYPE_DEFS[node.type].executable;

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-node-action]")) return;
    event.stopPropagation();
    select(node.id);

    // 引用拾取模式：点击即连线，不进入拖拽
    if (pickMode) {
      const { connectFrom, setConnectFrom } = useCanvasStore.getState();
      if (connectFrom && connectFrom !== node.id) {
        if (connectNodes(connectFrom, node.id)) {
          setConnectFrom(null);
        }
      }
      return;
    }

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
        "absolute flex cursor-grab flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg transition-shadow active:cursor-grabbing",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border",
        connectTarget && "border-success ring-2 ring-success/40",
        status === "failed" && "border-destructive/70",
        pickMode && !isPickSource && "cursor-pointer ring-2 ring-primary/50"
      )}
      style={{
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        height: nodeHeight(node.type),
        zIndex: selected ? 10 : 1,
      }}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", NODE_TYPE_ACCENT[node.type])} />

      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 pl-4">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            NODE_TYPE_TONE[node.type]
          )}
        >
          <NodeTypeIcon type={node.type} className="h-3.5 w-3.5" />
        </span>
        <h3 className="flex-1 truncate text-sm font-medium">
          {node.config.title || t(`nodeTypes.${node.type}`)}
        </h3>
        {executable && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-node-action="run"
            disabled={runDisabled}
            className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            title={t("runThisNode")}
            aria-label={t("runThisNode")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRunNode(node.id);
            }}
          >
            {isRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" fill="currentColor" />
            )}
          </Button>
        )}
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

      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden px-4 pb-3 text-xs text-muted-foreground">
        <NodePreview node={node} output={output} />
      </div>

      {error && (
        <p className="absolute inset-x-4 bottom-1 truncate text-[10px] text-destructive">
          {error}
        </p>
      )}
    </article>
  );
}

function NodePreview({ node, output }: { node: CanvasNodeDTO; output?: CanvasNodeOutput }) {
  const t = useTranslations("canvas");
  const openMediaPreview = useCanvasStore((s) => s.openMediaPreview);

  if (node.type === "text") {
    return (
      <p className="line-clamp-5 whitespace-pre-wrap leading-relaxed">
        {node.config.text || t("noPreview")}
      </p>
    );
  }

  if (node.type === "upload") {
    const mediaType = node.config.mediaType;
    const url = output?.urls?.[0];
    if (!url) return <p className="line-clamp-2">{node.config.fileName || t("noFile")}</p>;
    return (
      <div className="relative h-full">
        <UploadMedia
          kind={mediaType === "video" ? "video" : mediaType === "audio" ? "audio" : "image"}
          url={url}
          urls={output?.urls ?? [url]}
          title={node.config.fileName}
          openMediaPreview={openMediaPreview}
        />
        <p className="absolute inset-x-0 bottom-0 truncate bg-background/80 px-2 py-1 text-[10px] text-foreground/80">
          {node.config.fileName}
        </p>
      </div>
    );
  }

  if (node.type === "audio") {
    return (
      <div className="flex h-full flex-col">
        <p className="line-clamp-3 leading-relaxed">{node.config.text || t("noPreview")}</p>
        {output?.urls?.[0] ? (
          <audio
            src={output.urls[0]}
            controls
            preload="none"
            className="mt-auto w-full"
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <p className="mt-auto text-muted-foreground/60">{t("noPreview")}</p>
        )}
      </div>
    );
  }

  if (node.type === "image") {
    const urls = output?.urls ?? [];
    if (urls.length === 0) {
      return <p className="line-clamp-4 leading-relaxed">{node.config.prompt || t("noPreview")}</p>;
    }
    return (
      <div
        className={cn(
          "grid h-full gap-1.5",
          urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {urls.slice(0, 4).map((url, index) => (
          <button
            key={url}
            type="button"
            className="group relative min-h-0 overflow-hidden rounded-md bg-muted"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openMediaPreview({ kind: "image", urls: urls.slice(0, 4), index, title: node.config.title });
            }}
          >
            <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            {urls.length > 1 && (
              <Expand className="absolute right-1 top-1 h-3.5 w-3.5 rounded bg-background/70 p-0.5 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            )}
          </button>
        ))}
      </div>
    );
  }

  if (node.type === "storyboard") {
    const shots = output?.storyboard?.shots?.length;
    return (
      <div className="flex h-full flex-col">
        <p className="line-clamp-4 leading-relaxed">{node.config.brief || t("noPreview")}</p>
        <p className="mt-auto text-muted-foreground">
          {shots ? `${shots} ${t("shots")}` : t("shotsPlaceholder")}
        </p>
      </div>
    );
  }

  // video
  const url = output?.urls?.[0];
  if (!url) {
    return <p className="line-clamp-4 leading-relaxed">{node.config.prompt || t("noPreview")}</p>;
  }
  return (
    <div className="relative h-full">
      <video
        src={url}
        controls
        preload="metadata"
        className="h-full w-full rounded-md bg-black object-contain"
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        data-node-action="expand"
        className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-foreground/80 opacity-80 hover:opacity-100"
        title={t("preview")}
        aria-label={t("preview")}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          openMediaPreview({ kind: "video", urls: [url], title: node.config.title });
        }}
      >
        <Expand className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function UploadMedia({
  kind,
  url,
  urls,
  title,
  openMediaPreview,
}: {
  kind: "image" | "video" | "audio";
  url: string;
  urls: string[];
  title?: string;
  openMediaPreview: (preview: {
    kind: "image" | "video" | "audio";
    urls: string[];
    index?: number;
    title?: string;
  }) => void;
}) {
  if (kind === "audio") {
    return (
      <div className="flex h-full items-end pb-4">
        <audio
          src={url}
          controls
          preload="none"
          className="w-full"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="h-full w-full rounded-md bg-black object-contain"
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <button
      type="button"
      className="group relative block h-full w-full overflow-hidden rounded-md bg-muted"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        openMediaPreview({ kind: "image", urls, title });
      }}
    >
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    </button>
  );
}
