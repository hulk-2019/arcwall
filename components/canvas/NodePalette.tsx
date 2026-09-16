"use client";

import { useTranslations } from "next-intl";
import { NODE_TYPE_DEFS, NODE_TYPES } from "@/lib/canvas/registry";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasNodeType } from "@/types/canvas";
import { CanvasGlass } from "./CanvasGlass";
import { getStageSize, nextNodePosition } from "./geometry";
import { NODE_TYPE_TONE, NodeTypeIcon } from "./node-meta";

export function NodePalette() {
  const t = useTranslations("canvas");
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);

  const handleAdd = (type: CanvasNodeType) => {
    const stage = document.querySelector("[data-canvas-stage]") as HTMLElement | null;
    const { width, height } = getStageSize(stage);
    const { x, y } = nextNodePosition(
      nodes,
      useCanvasStore.getState().viewport,
      width,
      height
    );
    addNode(type, x, y);
  };

  return (
    <CanvasGlass className="pointer-events-auto absolute bottom-3 left-3 z-30 flex gap-1 p-1.5 md:bottom-auto md:left-4 md:top-20 md:w-[88px] md:flex-col md:gap-1.5 md:p-2">
      {NODE_TYPES.map((type) => {
        const cost = NODE_TYPE_DEFS[type].baseCost;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleAdd(type)}
            title={t(`nodeTypes.${type}`)}
            aria-label={t(`nodeTypes.${type}`)}
            className={cn(
              "flex min-h-11 min-w-11 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg px-1.5 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-[68px] md:w-full"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md",
                NODE_TYPE_TONE[type]
              )}
            >
              <NodeTypeIcon type={type} className="h-4 w-4" />
            </span>
            <span className="mt-1 hidden text-[10px] font-medium leading-tight md:block">
              {t(`nodeTypes.${type}`)}
            </span>
            {cost > 0 && (
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground md:block">
                {t("costHint", { count: cost })}
              </span>
            )}
          </button>
        );
      })}
    </CanvasGlass>
  );
}
