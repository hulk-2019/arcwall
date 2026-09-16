"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useCanvasStore } from "@/store/useCanvasStore";
import { EdgeLayer } from "./EdgeLayer";
import { NodeCard } from "./NodeCard";
import { NodePorts } from "./NodePorts";
import { fitNodesToView, outputPoint } from "./geometry";
import { useCanvasConnect } from "./hooks/useCanvasConnect";

export function CanvasStage() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);
  const select = useCanvasStore((s) => s.select);
  const deleteEdge = useCanvasStore((s) => s.deleteEdge);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const canvasId = useCanvasStore((s) => s.canvasId);
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
    if ((event.target as HTMLElement).closest?.("[data-node-id],[data-canvas-port]")) return;
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
      </div>
    </div>
  );
}
