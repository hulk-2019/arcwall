"use client";

import { Pencil, Trash2, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NodeTypeIcon } from "./node-meta";

export type ProjectCoverTile = {
  kind: "image" | "video";
  url: string;
};

export interface ProjectRow {
  id: number;
  name: string;
  canvasId: number | null;
  nodeCount: number;
  coverUrl: string | null;
  coverTiles?: ProjectCoverTile[];
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
  const tiles = project.coverTiles?.length
    ? project.coverTiles
    : project.coverUrl
      ? [{ kind: "image" as const, url: project.coverUrl }]
      : [];

  return (
    <article
      className={cn(
        "group cursor-pointer overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm",
        "transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
      )}
      onClick={onOpen}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <CoverMosaic tiles={tiles} />
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

function CoverMosaic({ tiles }: { tiles: ProjectCoverTile[] }) {
  if (tiles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-3 bg-gradient-to-br from-muted via-muted to-background text-muted-foreground">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas-image/10 text-canvas-image">
          <NodeTypeIcon type="image" className="h-5 w-5" />
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas-video/10 text-canvas-video">
          <NodeTypeIcon type="video" className="h-5 w-5" />
        </span>
      </div>
    );
  }

  if (tiles.length === 1) {
    return <CoverTileMedia tile={tiles[0]} />;
  }

  if (tiles.length === 2) {
    return (
      <div className="grid h-full grid-cols-2 gap-0.5 bg-background">
        {tiles.map((tile, index) => (
          <div key={`${tile.url}-${index}`} className="min-h-0 overflow-hidden">
            <CoverTileMedia tile={tile} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-0.5 bg-background">
      {tiles.slice(0, 4).map((tile, index) => (
        <div
          key={`${tile.url}-${index}`}
          className={cn("min-h-0 overflow-hidden", tiles.length === 3 && index === 0 && "row-span-2")}
        >
          <CoverTileMedia tile={tile} />
        </div>
      ))}
    </div>
  );
}

function CoverTileMedia({ tile }: { tile: ProjectCoverTile }) {
  if (tile.kind === "video") {
    return (
      <div className="relative h-full w-full">
        <video
          src={tile.url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onMouseEnter={(event) => {
            event.currentTarget.play().catch(() => undefined);
          }}
          onMouseLeave={(event) => {
            event.currentTarget.pause();
            event.currentTarget.currentTime = 0;
          }}
        />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-md bg-black/55 p-1 text-white">
          <Video className="h-3 w-3" aria-hidden />
        </span>
      </div>
    );
  }

  return <img src={tile.url} alt="" loading="lazy" className="h-full w-full object-cover" />;
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
