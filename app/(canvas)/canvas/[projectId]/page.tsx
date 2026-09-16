"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CanvasEditor } from "@/components/canvas/CanvasEditor";
import { useCanvasProject } from "@/components/canvas/hooks/useCanvasProject";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";

export default function CanvasEditorPage() {
  const params = useParams();
  const projectId = Number(params?.projectId);
  const t = useTranslations("canvas");
  const { projectName, snapshot, error, isLoading, reload } = useCanvasProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Loading text={t("loadingProject")} />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm text-muted-foreground">{error || t("loadFailed")}</p>
        <Button type="button" variant="outline" onClick={() => reload()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  return <CanvasEditor projectName={projectName} initialSnapshot={snapshot} />;
}
