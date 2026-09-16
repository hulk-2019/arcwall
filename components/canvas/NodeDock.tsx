"use client";

import { useState } from "react";
import { Eye, Link2, Loader2, Plus, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";
import { polishCanvasText } from "@/services/api";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeDTO } from "@/types/canvas";
import { NodeTypeIcon } from "./node-meta";
import { NODE_WIDTH, nodeHeight } from "./node-size";

const DOCK_GAP = 22;

interface NodeDockProps {
  node: CanvasNodeDTO;
}

/**
 * 选中节点下方的浮框面板（竖线连接）：
 * - 文本节点：直接编辑内容 + AI 润色；
 * - 生成类节点：引用管理（上游节点列表 / 添加引用 / 移除引用）+ 主提示词编辑；
 * - 上传节点：文件信息与预览入口。
 */
export function NodeDock({ node }: NodeDockProps) {
  const t = useTranslations("canvas");
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const setConnectFrom = useCanvasStore((s) => s.setConnectFrom);
  const connectFrom = useCanvasStore((s) => s.connectFrom);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const openMediaPreview = useCanvasStore((s) => s.openMediaPreview);

  const [polishing, setPolishing] = useState(false);

  const references = edges
    .filter((e) => e.targetNodeId === node.id)
    .map((e) => ({ edge: e, source: nodes.find((n) => n.id === e.sourceNodeId) }))
    .filter((r): r is { edge: (typeof edges)[number]; source: CanvasNodeDTO } => !!r.source);

  const hasInputs = NODE_TYPE_DEFS[node.type].inputs.length > 0;
  const picking = connectFrom === node.id;

  const promptField =
    node.type === "text"
      ? "text"
      : node.type === "storyboard"
        ? "brief"
        : node.type === "audio"
          ? "text"
          : node.type === "upload"
            ? null
            : "prompt";

  const handlePolish = async () => {
    const text = (node.config.text || "").trim();
    if (!text) {
      toast.error(t("polishEmpty"));
      return;
    }
    if (!canvasId) return;
    setPolishing(true);
    try {
      const res: any = await polishCanvasText(canvasId, text);
      if (res.code === 0 && res.data?.text) {
        updateNodeConfig(node.id, { ...node.config, text: res.data.text });
        toast.success(t("polishSuccess"));
      } else {
        toast.error(res.message || t("polishFailed"));
      }
    } catch (error: any) {
      toast.error(error?.message || t("polishFailed"));
    }
    setPolishing(false);
  };

  return (
    <div
      data-node-dock
      className="absolute z-20"
      style={{ left: node.x, top: node.y + nodeHeight(node.type) + DOCK_GAP, width: NODE_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {/* 竖线连接件 */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 -translate-x-1/2 rounded-full",
          picking ? "bg-primary" : "bg-primary/50"
        )}
        style={{ top: -DOCK_GAP, width: 2, height: DOCK_GAP }}
      />

      <div className="rounded-xl border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur">
        {hasInputs && (
          <section className="mb-2.5">
            <div className="mb-1.5 flex items-center justify-between">
              <h4 className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Link2 className="h-3 w-3" aria-hidden />
                {t("references")}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 rounded-full px-2 text-[11px] text-primary hover:text-primary"
                onClick={() => setConnectFrom(picking ? null : node.id)}
              >
                <Plus className="mr-0.5 h-3 w-3" aria-hidden />
                {picking ? t("cancelPick") : t("addReference")}
              </Button>
            </div>

            {picking && (
              <p className="mb-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] text-primary">
                {t("pickReferenceHint")}
              </p>
            )}

            {references.length === 0 ? (
              <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
                {t("noReferences")}
              </p>
            ) : (
              <ul className="space-y-1">
                {references.map(({ edge, source }) => (
                  <li
                    key={edge.id}
                    className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1"
                  >
                    <NodeTypeIcon type={source.type} className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-[11px]">
                      {source.config.title || t(`nodeTypes.${source.type}`)}
                      {source.type === "text" && source.config.text && (
                        <span className="ml-1 text-muted-foreground/70">
                          {source.config.text.slice(0, 24)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      title={t("removeReference")}
                      aria-label={t("removeReference")}
                      onClick={() => deleteEdge(edge.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {promptField && (
          <section>
            <h4 className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              {t(
                node.type === "text"
                  ? "textContent"
                  : node.type === "storyboard"
                    ? "storyboardBrief"
                    : node.type === "audio"
                      ? "audioText"
                      : "prompt"
              )}
            </h4>
            <Textarea
              value={(node.config[promptField] as string) || ""}
              placeholder={t("promptPlaceholder")}
              className="min-h-[64px] resize-none border-border/60 bg-muted/30 text-xs"
              rows={3}
              onChange={(e) =>
                updateNodeConfig(node.id, {
                  ...node.config,
                  [promptField]: e.target.value,
                })
              }
            />
            {node.type === "text" && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/70">{t("textDockHint")}</p>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 rounded-full px-3 text-[11px]"
                  disabled={polishing}
                  onClick={handlePolish}
                >
                  {polishing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" aria-hidden />
                  )}
                  {polishing ? t("polishing") : t("polish")}
                </Button>
              </div>
            )}
          </section>
        )}

        {node.type === "upload" && (
          <section className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
              {node.config.fileName || t("noFile")}
            </p>
            {node.output?.urls?.[0] && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 rounded-full px-3 text-[11px]"
                onClick={() =>
                  openMediaPreview({
                    kind:
                      node.config.mediaType === "video"
                        ? "video"
                        : node.config.mediaType === "audio"
                          ? "audio"
                          : "image",
                    urls: node.output!.urls!,
                    title: node.config.fileName,
                  })
                }
              >
                <Eye className="mr-1 h-3 w-3" aria-hidden />
                {t("preview")}
              </Button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
