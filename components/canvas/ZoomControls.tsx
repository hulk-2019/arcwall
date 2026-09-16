"use client";

import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/store/useCanvasStore";
import { CanvasGlass } from "./CanvasGlass";
import { fitNodesToView, getStageSize } from "./geometry";

export function ZoomControls() {
  const t = useTranslations("canvas");
  const nodes = useCanvasStore((s) => s.nodes);
  const viewport = useCanvasStore((s) => s.viewport);
  const setViewport = useCanvasStore((s) => s.setViewport);

  const handleFit = () => {
    const stage = document.querySelector("[data-canvas-stage]") as HTMLElement | null;
    const { width, height } = getStageSize(stage);
    setViewport(fitNodesToView(nodes, width, height));
  };

  return (
    <CanvasGlass className="pointer-events-auto absolute bottom-16 right-3 z-30 flex items-center gap-1 px-1.5 py-1 md:bottom-4 md:left-4 md:right-auto">
      <span className="hidden px-2 text-[11px] text-muted-foreground sm:inline">
        {t("nodeCount", { count: nodes.length })}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setViewport({ scale: Math.max(0.2, viewport.scale / 1.15) })}
        title={t("zoomOut")}
        aria-label={t("zoomOut")}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="w-10 text-center text-[11px] tabular-nums text-muted-foreground">
        {Math.round(viewport.scale * 100)}%
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setViewport({ scale: Math.min(2.5, viewport.scale * 1.15) })}
        title={t("zoomIn")}
        aria-label={t("zoomIn")}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={handleFit}
        title={t("fitView")}
        aria-label={t("fitView")}
      >
        <Maximize className="h-4 w-4" />
      </Button>
    </CanvasGlass>
  );
}
