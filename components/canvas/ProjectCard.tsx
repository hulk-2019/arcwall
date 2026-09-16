"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NodeTypeIcon } from "./node-meta";

export interface ProjectRow {
  id: number;
  name: string;
  canvasId: number | null;
  nodeCount: number;
  coverUrl: string | null;
  updatedAt?: string;
}

interface ProjectCardProps {
  project: ProjectRow;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onOpen: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

export function ProjectCard({
  project,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onOpen,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: ProjectCardProps) {
  const t = useTranslations("canvas");
  const locale = useLocale();

  return (
    <article
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-colors hover:border-primary/40"
      )}
      onClick={onOpen}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        {project.coverUrl ? (
          <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center gap-3 text-muted-foreground">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas-image/10 text-canvas-image">
              <NodeTypeIcon type="image" className="h-5 w-5" />
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-canvas-video/10 text-canvas-video">
              <NodeTypeIcon type="video" className="h-5 w-5" />
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <Input
              autoFocus
              value={renameValue}
              onChange={(event) => onRenameValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCommitRename();
                if (event.key === "Escape") onCancelRename();
              }}
              onClick={(event) => event.stopPropagation()}
              className="h-8"
            />
          ) : (
            <h2 className="truncate text-sm font-semibold">{project.name}</h2>
          )}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              title={t("rename")}
              aria-label={t("rename")}
              onClick={(event) => {
                event.stopPropagation();
                onStartRename();
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive"
              title={t("delete")}
              aria-label={t("delete")}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("nodeCount", { count: project.nodeCount })}
          {" · "}
          {formatUpdatedAt(project.updatedAt, locale, t)}
        </p>
      </div>
    </article>
  );
}

function formatUpdatedAt(
  value: string | undefined,
  locale: string,
  t: ReturnType<typeof useTranslations>
) {
  if (!value) return t("updatedJustNow");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("updatedJustNow");
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return t("updatedJustNow");
  return t("updatedAt", {
    time: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date),
  });
}
