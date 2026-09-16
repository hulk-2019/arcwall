"use client";

import { Fragment, type PointerEvent as ReactPointerEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";
import type { CanvasNodeDTO } from "@/types/canvas";
import { NODE_WIDTH, nodeHeight } from "./node-size";

const PORT_SIZE = 28;

interface NodePortsProps {
  nodes: CanvasNodeDTO[];
  sourceId: string | null;
  targetId: string | null;
  onBegin: (nodeId: string, event: ReactPointerEvent<HTMLElement>) => void;
  onMove: (event: ReactPointerEvent) => void;
  onUp: (event: ReactPointerEvent) => void;
}

export function NodePorts({
  nodes,
  sourceId,
  targetId,
  onBegin,
  onMove,
  onUp,
}: NodePortsProps) {
  return (
    <>
      {nodes.map((node) => (
        <Fragment key={node.id}>
          {NODE_TYPE_DEFS[node.type].inputs.length > 0 && (
            <Port
              side="in"
              left={node.x}
              top={node.y + nodeHeight(node.type) / 2}
              active={targetId === node.id}
              onPointerDown={(event) => event.stopPropagation()}
            />
          )}
          <Port
            side="out"
            left={node.x + NODE_WIDTH}
            top={node.y + nodeHeight(node.type) / 2}
            active={sourceId === node.id}
            onPointerDown={(event) => onBegin(node.id, event)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </Fragment>
      ))}
    </>
  );
}

function Port({
  side,
  left,
  top,
  active,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  side: "in" | "out";
  left: number;
  top: number;
  active?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: (event: ReactPointerEvent) => void;
  onPointerCancel?: (event: ReactPointerEvent) => void;
}) {
  return (
    <span
      data-canvas-port={side}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="group absolute z-40 flex cursor-crosshair items-center justify-center"
      style={{
        left: left - PORT_SIZE / 2,
        top: top - PORT_SIZE / 2,
        width: PORT_SIZE,
        height: PORT_SIZE,
        touchAction: "none",
      }}
    >
      <span
        className={cn(
          "flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-background text-background transition-transform",
          side === "out" ? "bg-primary" : "bg-foreground/70",
          active && "scale-125 bg-primary"
        )}
        style={{ width: 18, height: 18 }}
      >
        <Plus className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    </span>
  );
}
