"use client";

import type { CanvasEdgeDTO, CanvasNodeDTO } from "@/types/canvas";
import type { Viewport } from "@/store/useCanvasStore";
import { bezierPath, inputPoint, outputPoint, worldToScreen, type Point } from "./geometry";

interface EdgeLayerProps {
  nodes: CanvasNodeDTO[];
  edges: CanvasEdgeDTO[];
  viewport: Viewport;
  preview: { from: Point; to: Point } | null;
  onDeleteEdge: (id: string) => void;
  deleteTitle: string;
}

export function EdgeLayer({
  nodes,
  edges,
  viewport,
  preview,
  onDeleteEdge,
  deleteTitle,
}: EdgeLayerProps) {
  const nodeById = (id: string) => nodes.find((node) => node.id === id);
  const toScreen = (point: Point) => worldToScreen(point, viewport);

  return (
    <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible">
      {edges.map((edge) => {
        const source = nodeById(edge.sourceNodeId);
        const target = nodeById(edge.targetNodeId);
        if (!source || !target) return null;
        const d = bezierPath(toScreen(outputPoint(source)), toScreen(inputPoint(target)));
        return (
          <g
            key={edge.id}
            className="pointer-events-auto cursor-pointer"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDeleteEdge(edge.id);
            }}
          >
            <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
            <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} className="canvas-edge-flow" />
            <title>{deleteTitle}</title>
          </g>
        );
      })}
      {preview && (
        <path
          d={bezierPath(toScreen(preview.from), toScreen(preview.to))}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="pointer-events-none opacity-70"
        />
      )}
    </svg>
  );
}
