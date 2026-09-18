"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  Square,
  Undo2,
  Redo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { NODE_TYPE_DEFS } from "@/lib/canvas/registry";
import { useAppStore } from "@/store/useAppStore";
import { useCanvasStore } from "@/store/useCanvasStore";
import type { ExecutionDTO, ExecutionScope } from "@/types/canvas";
import { CanvasGlass } from "./CanvasGlass";
import { isExecutionActive } from "./hooks/useCanvasExecution";

interface CanvasToolbarProps {
  projectName: string;
  isRunning: boolean;
  isCancelling?: boolean;
  execution: ExecutionDTO | null;
  onRun: (scope: ExecutionScope) => void;
  onCancelExecution?: () => void;
}

export function CanvasToolbar({
  projectName,
  isRunning,
  isCancelling = false,
  execution,
  onRun,
  onCancelExecution,
}: CanvasToolbarProps) {
  const t = useTranslations("canvas");
  const tHeader = useTranslations("header");
  const user = useAppStore((s) => s.user);
  const nodes = useCanvasStore((s) => s.nodes);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const dirty = useCanvasStore((s) => s.dirty);
  const isSaving = useCanvasStore((s) => s.isSaving);

  const hasExecutable = nodes.some((node) => NODE_TYPE_DEFS[node.type].executable);
  const saveStatus = isSaving ? t("saving") : dirty ? t("unsaved") : t("saved");
  const generating = isExecutionActive(execution?.status);

  return (
    <CanvasGlass className="pointer-events-auto absolute inset-x-3 top-3 z-30 flex items-center gap-2 px-2 py-1.5 md:inset-x-4 md:px-3">
      <Button variant="ghost" size="sm" className="h-9 shrink-0 gap-1.5 px-2" asChild>
        <Link href="/canvas">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("back")}</span>
        </Link>
      </Button>

      <span className="hidden h-5 w-px bg-border sm:block" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{projectName}</p>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3 w-3" aria-hidden />
          )}
          {saveStatus}
        </p>
      </div>

      {user?.credits && (
        <span className="hidden text-xs text-muted-foreground md:inline">
          {tHeader("creditsLabel")} {user.credits.left_credits}
        </span>
      )}

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={undo}
          title={t("undo")}
          aria-label={t("undo")}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={redo}
          title={t("redo")}
          aria-label={t("redo")}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <span className="hidden h-5 w-px bg-border md:block" />

      <div className="hidden items-center gap-1 md:flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9"
          disabled={!hasExecutable || isRunning}
          onClick={() => onRun("all")}
        >
          <Layers className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {t("runAll")}
        </Button>
      </div>

      <div className="flex items-center gap-1 md:hidden">
        <Button
          type="button"
          size="icon"
          className="h-9 w-9"
          disabled={!hasExecutable || isRunning}
          onClick={() => onRun("all")}
          aria-label={t("runAll")}
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
        </Button>
      </div>

      {generating && (
        <span className="hidden items-center gap-1 text-xs text-primary lg:flex">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {execution?.status === "cancel_requested" ? t("cancelling") : t("generating")}
        </span>
      )}

      {generating && onCancelExecution && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5 text-destructive hover:text-destructive"
          disabled={isCancelling}
          onClick={onCancelExecution}
          title={t("cancelExecution")}
          aria-label={t("cancelExecution")}
        >
          {isCancelling ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Square className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="hidden lg:inline">
            {isCancelling ? t("cancelling") : t("cancelExecution")}
          </span>
        </Button>
      )}

      <span className="hidden h-5 w-px bg-border sm:block" />

      <div className="flex items-center gap-1">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </CanvasGlass>
  );
}
