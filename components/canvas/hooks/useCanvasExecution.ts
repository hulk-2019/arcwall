"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";
import {
  cancelCanvasExecution,
  estimateCanvasRun,
  getCanvasExecution,
  getCanvasSnapshot,
  listCanvasExecutions,
  runCanvas,
} from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { EstimateDTO, ExecutionDTO, ExecutionScope } from "@/types/canvas";

const TERMINAL: ExecutionDTO["status"][] = [
  "succeeded",
  "failed",
  "cancelled",
  "partially_succeeded",
];

export function isExecutionActive(status?: ExecutionDTO["status"]) {
  return !!status && !TERMINAL.includes(status);
}

/**
 * 画布执行前端编排（PRD-RUN-001/002/003、PRD-VID-004/005）：
 * 运行前估算确认 → 提交（幂等键）→ 轮询期间把步骤状态实时映射到节点
 * → 终态刷新快照与余额。进入画布时恢复后台运行中的执行。
 */
export function useCanvasExecution() {
  const t = useTranslations("canvas");
  const fetchUserCredits = useAppStore((s) => s.fetchUserCredits);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const canvasId = useCanvasStore((s) => s.canvasId);
  const flush = useCanvasStore((s) => s.flush);
  const loadSnapshot = useCanvasStore((s) => s.loadSnapshot);
  const applyExecution = useCanvasStore((s) => s.applyExecution);
  const clearLiveExecution = useCanvasStore((s) => s.clearLiveExecution);

  const [execution, setExecution] = useState<ExecutionDTO | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [estimate, setEstimate] = useState<EstimateDTO | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingScopeRef = useRef<{ scope: ExecutionScope; rootNodeId?: string } | null>(null);

  // 进入画布：恢复后台运行中的执行（离开页面不取消服务端任务）
  useEffect(() => {
    if (!canvasId) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await listCanvasExecutions(canvasId, true);
        if (cancelled || res.code !== 0 || !Array.isArray(res.data)) return;
        const active = res.data.find((e: ExecutionDTO) => isExecutionActive(e.status));
        if (active) {
          setExecution(active);
          setIsRunning(true);
          toast.info(t("executionResumed"));
        }
      } catch (error) {
        console.error("resume execution failed", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasId, t]);

  // 轮询进行中的执行，并把步骤状态映射到节点（liveExecution overlay）
  useEffect(() => {
    if (!execution || !isExecutionActive(execution.status)) return;
    applyExecution(execution);

    const timer = setInterval(async () => {
      try {
        const res: any = await getCanvasExecution(execution.id);
        if (res.code === 0 && res.data) setExecution(res.data);
      } catch (error) {
        console.error("poll execution failed", error);
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [execution, applyExecution]);

  // 终态：刷新快照与余额
  useEffect(() => {
    if (!execution || isExecutionActive(execution.status)) return;

    (async () => {
      clearLiveExecution();
      if (canvasId) {
        try {
          const res: any = await getCanvasSnapshot(canvasId);
          if (res.code === 0 && res.data) loadSnapshot(res.data);
        } catch (error) {
          console.error("reload snapshot failed", error);
        }
      }
      fetchUserCredits();
      setIsRunning(false);
      setIsSubmitting(false);

      if (execution.status === "failed") {
        toast.error(t("status.failed"));
      } else if (execution.status === "cancelled") {
        toast.info(t("status.cancelled"));
      } else {
        toast.success(t("executionFinished"));
      }
    })();
  }, [canvasId, execution, fetchUserCredits, loadSnapshot, clearLiveExecution, t]);

  // 第一步：估算并弹出确认（显示范围、节点与成本）
  // rootNodeId 显式指定时优先于选中节点（节点内「运行此节点」按钮）
  const requestRun = useCallback(
    async (scope: ExecutionScope, rootNodeId?: string) => {
      if (!canvasId) return;
      const targetId = rootNodeId ?? (scope !== "all" ? selectedId : null);
      if (scope !== "all" && targetId == null) {
        toast.error(t("runFailed"));
        return;
      }

      const targetNode = nodes.find((n) => n.id === targetId);
      if (scope !== "all" && targetNode && !NODE_TYPE_DEFS[targetNode.type].executable) {
        return;
      }

      await flush();
      try {
        const res: any = await estimateCanvasRun({
          canvasId,
          scope,
          rootNodeId: scope !== "all" ? targetId! : undefined,
        });
        if (res.code === 0 && res.data) {
          pendingScopeRef.current = {
            scope,
            rootNodeId: scope !== "all" ? targetId! : undefined,
          };
          setEstimate(res.data);
          setConfirmOpen(true);
          return;
        }
        toast.error(res.message || t("runFailed"));
      } catch (error: any) {
        toast.error(error?.message || t("runFailed"));
      }
    },
    [canvasId, flush, nodes, selectedId, t]
  );

  /** 节点内「运行此节点」入口：以该节点为根节点执行 */
  const runNode = useCallback(
    (nodeId: string) => {
      void requestRun("node", nodeId);
    },
    [requestRun]
  );

  /** 节点内「运行下游」入口：以该节点为根执行其与全部下游 */
  const runDownstreamNode = useCallback(
    (nodeId: string) => {
      void requestRun("downstream", nodeId);
    },
    [requestRun]
  );

  // 第二步：确认后提交（幂等键防重复）
  const confirmRun = useCallback(async () => {
    const pending = pendingScopeRef.current;
    if (!pending || !canvasId) return;
    setConfirmOpen(false);
    setIsSubmitting(true);
    try {
      const res: any = await runCanvas({
        canvasId,
        idempotencyKey: crypto.randomUUID(),
        scope: pending.scope,
        rootNodeId: pending.rootNodeId,
      });
      if (res.code === 0 && res.data) {
        setExecution(res.data);
        setIsRunning(true);
        setIsSubmitting(false); // 运行中状态由 isRunning 承接，避免终态后仍被置灰
        return;
      }
      toast.error(res.message || t("runFailed"));
    } catch (error: any) {
      toast.error(error?.message || t("runFailed"));
    }
    setIsSubmitting(false);
  }, [canvasId, t]);

  const closeConfirm = useCallback(() => {
    setConfirmOpen(false);
    setEstimate(null);
    pendingScopeRef.current = null;
  }, []);

  // 取消服务端任务（区别于“停止轮询”，PRD-VID-005）
  const cancelExecution = useCallback(async () => {
    if (!execution || !isExecutionActive(execution.status)) return;
    setIsCancelling(true);
    try {
      const res: any = await cancelCanvasExecution(execution.id);
      if (res.code === 0 && res.data) {
        setExecution(res.data);
      } else {
        toast.error(res.message || t("runFailed"));
      }
    } catch (error: any) {
      toast.error(error?.message || t("runFailed"));
    }
    setIsCancelling(false);
  }, [execution, t]);

  return {
    execution,
    isRunning: isRunning || isSubmitting,
    isSubmitting,
    isCancelling,
    estimate,
    confirmOpen,
    requestRun,
    runNode,
    runDownstreamNode,
    confirmRun,
    closeConfirm,
    cancelExecution,
  };
}
