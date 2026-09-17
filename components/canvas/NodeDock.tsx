"use client";

import { useState } from "react";
import { ChevronsDown, Link2, Loader2, Play, Plus, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { NODE_TYPE_DEFS, estimateNodeCost } from "@/lib/canvas/registry";
import { polishCanvasText } from "@/services/api";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeConfig, CanvasNodeDTO } from "@/types/canvas";
import { NodeTypeIcon } from "./node-meta";
import { PropertyFields } from "./PropertyFields";
import { NODE_WIDTH, nodeHeight } from "./node-size";

const DOCK_GAP = 22;
const DOCK_WIDTH = 448;

interface NodeDockProps {
  node: CanvasNodeDTO;
  /** 底部运行按钮（仅可执行节点显示） */
  onRunNode: (nodeId: string) => void;
  onRunDownstream: (nodeId: string) => void;
  runDisabled: boolean;
}

/**
 * 选中节点下方的浮框面板（竖线连接），承载节点的全部配置编辑：
 * 引用管理 / 主提示词 / 参数字段 / 运行按钮。
 * 文本节点：直接编辑内容 + AI 润色；上传节点：文件上传与管理。
 */
export function NodeDock({ node, onRunNode, onRunDownstream, runDisabled }: NodeDockProps) {
  const t = useTranslations("canvas");
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const editNodeConfig = useCanvasStore((s) => s.editNodeConfig);
  const beginEdit = useCanvasStore((s) => s.beginEdit);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const setConnectFrom = useCanvasStore((s) => s.setConnectFrom);
  const connectFrom = useCanvasStore((s) => s.connectFrom);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const live = useCanvasStore((s) => s.liveExecution);

  const [polishing, setPolishing] = useState(false);

  const references = edges
    .filter((e) => e.targetNodeId === node.id)
    .map((e) => ({ edge: e, source: nodes.find((n) => n.id === e.sourceNodeId) }))
    .filter((r): r is { edge: (typeof edges)[number]; source: CanvasNodeDTO } => !!r.source);

  const hasInputs = NODE_TYPE_DEFS[node.type].inputs.length > 0;
  const executable = NODE_TYPE_DEFS[node.type].executable;
  const picking = connectFrom === node.id;
  const status = live?.statusByNode?.[node.id] ?? node.status;
  const isRunning = status === "running" || status === "queued" || status === "pending";

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

  const labels = {
    titleLabel: t("titleLabel"),
    model: t("model"),
    mode: t("mode"),
    vocal: t("vocal"),
    modeSong: t("modeSong"),
    modeMusic: t("modeMusic"),
    vocalAuto: t("vocalAuto"),
    vocalMale: t("vocalMale"),
    vocalFemale: t("vocalFemale"),
    voice: t("voice"),
    speed: t("speed"),
    aspectRatio: t("aspectRatio"),
    count: t("count"),
    layout: t("layout"),
    visualLock: t("visualLock"),
    videoMode: t("videoMode"),
    videoModeText: t("videoModeText"),
    videoModeImage: t("videoModeImage"),
    duration: t("duration"),
    resolution: t("resolution"),
    uploadFile: t("uploadFile"),
    uploading: t("uploading"),
    uploadSuccess: t("uploadSuccess"),
    uploadFailed: t("uploadFailed"),
    uploadTypeInvalid: t("uploadTypeInvalid"),
    uploadTooLarge: t("uploadTooLarge"),
    noFile: t("noFile"),
    layouts: t.raw("layouts") as Record<string, string>,
  };

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
      style={{ left: node.x, top: node.y + nodeHeight(node) + DOCK_GAP, width: DOCK_WIDTH }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {/* 竖线连接件 */}
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full",
          picking ? "bg-primary" : "bg-primary/50"
        )}
        style={{ left: NODE_WIDTH / 2 - 1, top: -DOCK_GAP, width: 2, height: DOCK_GAP }}
      />

      <div className="max-h-[60vh] overflow-y-auto rounded-xl border bg-card/95 p-3 text-card-foreground shadow-xl backdrop-blur">
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
                    <NodeTypeIcon
                      type={source.type}
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                    />
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
          <section className="mb-1">
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

        {/* 参数字段（标题 / 模型参数 / 上传管理），compact 模式跳过与上方重复的主文本框 */}
        <PropertyFields
          type={node.type}
          config={node.config}
          previewUrl={node.output?.urls?.[0]}
          labels={labels}
          onBeginEdit={beginEdit}
          onPatch={(patch: Partial<CanvasNodeConfig>) =>
            updateNodeConfig(node.id, { ...node.config, ...patch })
          }
          onDiscrete={(patch: Partial<CanvasNodeConfig>) =>
            editNodeConfig(node.id, { ...node.config, ...patch })
          }
        />

        {executable && (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t("runConfirmTotal")} {estimateNodeCost(node.type, node.config)} {t("creditsUnit")}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                disabled={runDisabled}
                title={t("runDownstreamNode")}
                aria-label={t("runDownstreamNode")}
                onClick={() => onRunDownstream(node.id)}
              >
                <ChevronsDown className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("runDownstreamNode")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-full px-4 text-xs"
                disabled={runDisabled}
                onClick={() => onRunNode(node.id)}
              >
                {isRunning ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" aria-hidden fill="currentColor" />
                )}
                {t("runThisNode")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
