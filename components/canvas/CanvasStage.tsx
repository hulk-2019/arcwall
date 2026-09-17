"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { EdgeLayer } from "./EdgeLayer";
import { NodeActionToolbar } from "./NodeActionToolbar";
import { NodeCard } from "./NodeCard";
import { NodeDock } from "./NodeDock";
import { NodePorts } from "./NodePorts";
import { fitNodesToView, outputPoint } from "./geometry";
import { useCanvasConnect } from "./hooks/useCanvasConnect";

interface CanvasStageProps {
  /** 节点内「运行此节点」按钮回调 */
  onRunNode: (nodeId: string) => void;
  /** 节点内「运行下游」按钮回调 */
  onRunDownstream: (nodeId: string) => void;
  /** 全局有执行进行中时禁用各节点运行按钮 */
  runDisabled: boolean;
}

export function CanvasStage({ onRunNode, onRunDownstream, runDisabled }: CanvasStageProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const select = useCanvasStore((s) => s.select);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const connectFrom = useCanvasStore((s) => s.connectFrom);
  const setConnectFrom = useCanvasStore((s) => s.setConnectFrom);
  const t = useTranslations("canvas");

  const containerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; vpX: number; vpY: number } | null>(null);
  const { session, begin, onMove, onUp, isConnecting } = useCanvasConnect(containerRef);

  const sourceNode = session ? nodes.find((node) => node.id === session.sourceId) : null;

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = useCanvasStore.getState().viewport;
      const newScale = Math.min(2.5, Math.max(0.2, next.scale * (event.deltaY < 0 ? 1.1 : 0.9)));
      const cx = event.clientX - rect.left;
      const cy = event.clientY - rect.top;
      setViewport({
        scale: newScale,
        x: cx - ((cx - next.x) / next.scale) * newScale,
        y: cy - ((cy - next.y) / next.scale) * newScale,
      });
    },
    [setViewport]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useLayoutEffect(() => {
    if (canvasId == null) return;
    const el = containerRef.current;
    if (!el) return;
    setViewport(
      fitNodesToView(useCanvasStore.getState().nodes, el.clientWidth, el.clientHeight)
    );
  }, [canvasId, setViewport]);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0 || isConnecting()) return;
    if (
      (event.target as HTMLElement).closest?.(
        "[data-node-id],[data-node-dock],[data-node-toolbar],[data-canvas-port]"
      )
    )
      return;
    // 点击空白处退出引用拾取模式
    if (useCanvasStore.getState().connectFrom) setConnectFrom(null);
    select(null);
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      vpX: viewport.x,
      vpY: viewport.y,
    };
    containerRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (isConnecting()) {
      onMove(event);
      return;
    }
    if (!panRef.current) return;
    setViewport({
      x: panRef.current.vpX + (event.clientX - panRef.current.startX),
      y: panRef.current.vpY + (event.clientY - panRef.current.startY),
    });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (isConnecting()) {
      onUp(event);
      return;
    }
    if (!panRef.current) return;
    panRef.current = null;
    if (containerRef.current?.hasPointerCapture(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      data-canvas-stage
      className={`canvas-dot-grid absolute inset-0 overflow-hidden ${
        session ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
      }`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ touchAction: "none" }}
    >
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="max-w-sm px-6 text-center">
            <p className="text-sm font-medium text-foreground">{t("emptyCanvasTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyCanvasHint")}</p>
          </div>
        </div>
      )}

      <EdgeLayer
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        preview={
          sourceNode && session
            ? { from: outputPoint(sourceNode), to: session.cursor }
            : null
        }
        onDeleteEdge={deleteEdge}
        deleteTitle={t("deleteEdge")}
      />

      {connectFrom && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur">
          <span className="text-primary">{t("pickReferenceHint")}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            title={t("cancelPick")}
            aria-label={t("cancelPick")}
            onClick={() => setConnectFrom(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className="absolute left-0 top-0 z-[2] origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
        }}
      >
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            selected={node.id === selectedId}
            connectTarget={node.id === session?.targetId}
            scale={viewport.scale}
            pickMode={!!connectFrom}
            isPickSource={node.id === connectFrom}
          />
        ))}
        <NodePorts
          nodes={nodes}
          sourceId={session?.sourceId ?? null}
          targetId={session?.targetId ?? null}
          onBegin={begin}
          onMove={onMove}
          onUp={onUp}
        />
        {(() => {
          const selected = nodes.find((n) => n.id === selectedId);
          return selected ? <NodeActionToolbar node={selected} /> : null;
        })()}
        {(() => {
          const selected = nodes.find((n) => n.id === selectedId);
          return selected ? (
            <NodeDock
              node={selected}
              onRunNode={onRunNode}
              onRunDownstream={onRunDownstream}
              runDisabled={runDisabled}
            />
          ) : null;
        })()}
      </div>
    </div>
  );
}
