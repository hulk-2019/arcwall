"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO, CanvasNodeOutput } from "@/types/canvas";
import { NODE_TYPE_ACCENT, NODE_TYPE_TONE, NodeTypeIcon, STATUS_BADGE } from "./node-meta";
import { NODE_WIDTH, nodeHeight } from "./node-size";

/** 未生成时的占位：铺满媒体区（区域高度已按画幅计算），展示提示词 */
function RatioPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-muted/30 px-3 text-center text-xs text-muted-foreground/70">
      <span className="line-clamp-3 leading-relaxed">{children}</span>
    </div>
  );
}

interface NodeCardProps {
  node: CanvasNodeDTO;
  selected: boolean;
  scale: number;
  connectTarget: boolean;
  /** 引用拾取模式：非空时点击节点 = 建立引用连线 */
  pickMode: boolean;
  isPickSource: boolean;
}

export function NodeCard({
  node,
  selected,
  scale,
  connectTarget,
  pickMode,
  isPickSource,
}: NodeCardProps) {
  const moveNode = useCanvasStore((s) => s.moveNode);
  const select = useCanvasStore((s) => s.select);
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

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("[data-node-action]")) return;
    event.stopPropagation();
    select(node.id);

    // 引用拾取模式：点击即连线，不进入拖拽
    if (pickMode) {
      const { connectFrom, setConnectFrom } = useCanvasStore.getState();
      if (connectFrom && connectFrom !== node.id) {
        const result = connectNodes(connectFrom, node.id);
        if (result.ok) {
          setConnectFrom(null);
        } else {
          toast.error(t(result.errorKey));
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
        height: nodeHeight(node),
        zIndex: selected ? 10 : 1,
      }}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", NODE_TYPE_ACCENT[node.type])} />

      {/* 头部：左侧名称，右侧状态（生成中显示 loading） */}
      <div className="flex items-center gap-2 px-3 pb-1 pt-2.5 pl-4">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            NODE_TYPE_TONE[node.type]
          )}
        >
          <NodeTypeIcon type={node.type} className="h-3.5 w-3.5" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
          {node.config.title || t(`nodeTypes.${node.type}`)}
        </h3>
        {node.outputStale && !isRunning && (
          <span
            className="inline-flex shrink-0 cursor-help items-center rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning"
            title={t("staleOutputHint")}
          >
            {t("staleOutput")}
          </span>
        )}
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
            STATUS_BADGE[status] || STATUS_BADGE.idle
          )}
        >
          {isRunning && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />}
          {t(`status.${status || "idle"}`)}
        </span>
      </div>

      {/* 媒体类节点（图片/视频）内容区无内边距，按画幅撑满避免留白 */}
      <div
        className={cn(
          "relative mt-2 min-h-0 flex-1 overflow-hidden",
          node.type === "image" || node.type === "video"
            ? ""
            : "px-4 pb-3 text-xs text-muted-foreground"
        )}
      >
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
      return <RatioPlaceholder>{node.config.prompt || t("noPreview")}</RatioPlaceholder>;
    }
    // 单图：媒体区比例即画幅，铺满无留白；多图（历史数据）：网格铺满
    if (urls.length === 1) {
      return (
        <img
          src={urls[0]}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover"
          loading="lazy"
        />
      );
    }
    return (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1 overflow-hidden">
        {urls.slice(0, 4).map((url) => (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
            loading="lazy"
          />
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

  // video：媒体区比例即画幅，播放器铺满无留白
  const url = output?.urls?.[0];
  if (!url) {
    return <RatioPlaceholder>{node.config.prompt || t("noPreview")}</RatioPlaceholder>;
  }
  return (
    <video
      src={url}
      controls
      preload="metadata"
      className="h-full w-full bg-black object-cover"
    />
  );
}

function UploadMedia({
  kind,
  url,
}: {
  kind: "image" | "video" | "audio";
  url: string;
}) {
  if (kind === "audio") {
    return (
      <div className="flex h-full items-end pb-4">
        <audio src={url} controls preload="none" className="w-full" />
      </div>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="max-h-full max-w-full rounded-md bg-black object-contain"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-muted">
      <img
        src={url}
        alt=""
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        loading="lazy"
      />
    </div>
  );
}
