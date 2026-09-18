"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Plus, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createCanvasProject,
  deleteCanvasProject,
  getCanvasProjects,
  renameCanvasProject,
} from "@/services/api";
import { ProjectCard, type ProjectRow } from "./ProjectCard";
import { ProjectCreateDialog, ProjectDeleteDialog } from "./ProjectDialogs";

export function ProjectList() {
  const router = useRouter();
  const t = useTranslations("canvas");
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["canvas-projects"],
    queryFn: async () => getCanvasProjects(),
  });
  const projects: ProjectRow[] = (data as any)?.data || [];

  const createMutation = useMutation({
    mutationFn: createCanvasProject,
    onSuccess: (res: any) => {
      if (res.code === 0 && res.data) {
        qc.invalidateQueries({ queryKey: ["canvas-projects"] });
        setCreateOpen(false);
        setNewName("");
        router.push(`/canvas/${res.data.id}`);
        return;
      }
      toast.error(t("runFailed"));
    },
    onError: () => toast.error(t("runFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCanvasProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canvas-projects"] });
      setDeletingId(null);
    },
    onError: () => toast.error(t("runFailed")),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameCanvasProject(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canvas-projects"] });
      setRenamingId(null);
    },
    onError: () => toast.error(t("runFailed")),
  });

  return (
    <div className="canvas-dot-grid min-h-[calc(100dvh-4rem)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-12">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" aria-hidden />
              {t("title")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{t("projectListTitle")}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t("projectListSubtitle")}</p>
          </div>
          <Button type="button" className="h-11 rounded-full px-5" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("newProject")}
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-border bg-card/80 px-6 py-16 text-center backdrop-blur">
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </div>
        )}

        {!isLoading && !isError && projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-20 text-center backdrop-blur">
            <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{t("emptyProjects")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyDesc")}</p>
            <Button type="button" className="mt-5 rounded-full" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              {t("newProject")}
            </Button>
          </div>
        )}

        {!isLoading && !isError && projects.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isRenaming={renamingId === project.id}
                renameValue={renameValue}
                onRenameValueChange={setRenameValue}
                onOpen={() => router.push(`/canvas/${project.id}`)}
                onStartRename={() => {
                  setRenamingId(project.id);
                  setRenameValue(project.name);
                }}
                onCommitRename={() =>
                  renameMutation.mutate({ id: project.id, name: renameValue.trim() || project.name })
                }
                onCancelRename={() => setRenamingId(null)}
                onDelete={() => setDeletingId(project.id)}
              />
            ))}
          </div>
        )}

        <ProjectCreateDialog
          open={createOpen}
          name={newName}
          isPending={createMutation.isPending}
          onOpenChange={setCreateOpen}
          onNameChange={setNewName}
          onSubmit={() => createMutation.mutate(newName.trim() || undefined)}
        />
        <ProjectDeleteDialog
          open={deletingId != null}
          isPending={deleteMutation.isPending}
          onOpenChange={(open) => {
            if (!open) setDeletingId(null);
          }}
          onConfirm={() => {
            if (deletingId != null) deleteMutation.mutate(deletingId);
          }}
        />
      </div>
    </div>
  );
}
