"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getCanvasProject, getCanvasSnapshot } from "@/services/api";
import type { CanvasSnapshot } from "@/types/canvas";

export function useCanvasProject(projectId: number) {
  const t = useTranslations("canvas");
  const [projectName, setProjectName] = useState(t("untitled"));
  const [snapshot, setSnapshot] = useState<CanvasSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(projectId)) {
      setError(t("loadFailed"));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const project: any = await getCanvasProject(projectId);
      if (project.code !== 0 || !project.data?.canvasId) {
        setError(project.message || t("loadFailed"));
        setSnapshot(null);
        return;
      }
      setProjectName(project.data.name || t("untitled"));
      const snap: any = await getCanvasSnapshot(project.data.canvasId);
      if (snap.code !== 0 || !snap.data) {
        setError(snap.message || t("loadFailed"));
        setSnapshot(null);
        return;
      }
      setSnapshot(snap.data);
    } catch (loadError) {
      console.error("load canvas failed", loadError);
      setError(t("loadFailed"));
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return { projectName, snapshot, error, isLoading, reload: load };
}
