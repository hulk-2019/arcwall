"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { saveCanvasOnUnload } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { CanvasSnapshot } from "@/types/canvas";
import { CanvasStage } from "./CanvasStage";
import { CanvasToolbar } from "./CanvasToolbar";
import { MediaPreviewDialog } from "./MediaPreviewDialog";
import { NodePalette } from "./NodePalette";
import { PropertiesPanel } from "./PropertiesPanel";
import { RunConfirmDialog } from "./RunConfirmDialog";
import { ZoomControls } from "./ZoomControls";
import { useCanvasExecution } from "./hooks/useCanvasExecution";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";

interface CanvasEditorProps {
  projectName: string;
  initialSnapshot: CanvasSnapshot;
}

export function CanvasEditor({ projectName, initialSnapshot }: CanvasEditorProps) {
  const t = useTranslations("canvas");
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const user = useAppStore((s) => s.user);
  const {
    execution,
    isRunning,
    isCancelling,
    estimate,
    confirmOpen,
    requestRun,
    runNode,
    confirmRun,
    closeConfirm,
    cancelExecution,
  } = useCanvasExecution();
  const [propertiesOpen, setPropertiesOpen] = useState(false);

  useLayoutEffect(() => {
    loadSnapshot(initialSnapshot);
  }, [initialSnapshot, loadSnapshot]);

  // 防抖窗口内刷新/离开页面时，把未保存的操作用 keepalive 请求兜底提交，
  // 避免「连线后立刻刷新导致连线丢失」。
  useEffect(() => {
    const handlePageHide = () => {
      const state = useCanvasStore.getState();
      if (state.canvasId && state.pendingOps.length > 0) {
        void saveCanvasOnUnload(state.canvasId, state.pendingOps);
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  useCanvasKeyboard(requestRun);

  return (
    <div data-canvas className="relative h-dvh w-full overflow-hidden bg-background">
      <CanvasStage onRunNode={runNode} runDisabled={isRunning} />
      <div className="pointer-events-none absolute inset-0">
        <CanvasToolbar
          projectName={projectName}
          isRunning={isRunning}
          isCancelling={isCancelling}
          execution={execution}
          onRun={requestRun}
          onCancelExecution={cancelExecution}
          onOpenProperties={() => setPropertiesOpen(true)}
        />
        <NodePalette />
        <PropertiesPanel open={propertiesOpen} onOpenChange={setPropertiesOpen} />
        <ZoomControls />
        <p className="pointer-events-none absolute bottom-5 left-1/2 hidden max-w-md -translate-x-1/2 text-center text-[11px] text-muted-foreground lg:block">
          {t("connectHint")}
        </p>
      </div>

      <RunConfirmDialog
        open={confirmOpen}
        estimate={estimate}
        balance={user?.credits?.left_credits}
        onConfirm={confirmRun}
        onCancel={closeConfirm}
      />

      <MediaPreviewDialog />
    </div>
  );
}
