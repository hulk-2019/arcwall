"use client";

import { useEffect } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { ExecutionScope } from "@/types/canvas";

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function useCanvasKeyboard(onRun: (scope: ExecutionScope) => void) {
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const select = useCanvasStore((s) => s.select);
  const deleteNode = useCanvasStore((s) => s.deleteNode);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (meta && event.key === "Enter") {
        event.preventDefault();
        onRun("node");
        return;
      }

      if (event.key === "Escape") {
        // 引用拾取模式优先退出，其次取消选中
        const { connectFrom, setConnectFrom } = useCanvasStore.getState();
        if (connectFrom) {
          setConnectFrom(null);
          return;
        }
        select(null);
        return;
      }

      if (isEditingTarget(event.target)) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        const selectedId = useCanvasStore.getState().selectedId;
        if (selectedId == null) return;
        event.preventDefault();
        deleteNode(selectedId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteNode, onRun, redo, select, undo]);
}
