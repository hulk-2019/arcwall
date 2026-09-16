"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EstimateDTO } from "@/types/canvas";
import { NodeTypeIcon } from "./node-meta";

interface RunConfirmDialogProps {
  open: boolean;
  estimate: EstimateDTO | null;
  /** 当前余额；不足时禁止提交（PRD 九点一：额度不足在提交前阻止） */
  balance?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 运行前确认（PRD-RUN-001/002）：明确展示执行范围、逐节点成本与余额。
 */
export function RunConfirmDialog({
  open,
  estimate,
  balance,
  onConfirm,
  onCancel,
}: RunConfirmDialogProps) {
  const t = useTranslations("canvas");

  if (!estimate) return null;

  const scopeLabel =
    estimate.scope === "node"
      ? t("scopeNode")
      : estimate.scope === "downstream"
        ? t("scopeDownstream")
        : t("scopeAll");
  const insufficient = balance != null && balance < estimate.totalCredits;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("runConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("runConfirmScope")}: {scopeLabel} ·{" "}
            {t("runConfirmNodes", { count: estimate.items.length })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {estimate.items.map((item) => (
            <li
              key={item.nodeId}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
            >
              <NodeTypeIcon type={item.nodeType} className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                {item.title || t(`nodeTypes.${item.nodeType}`)}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {item.credits} {t("creditsUnit")}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("runConfirmTotal")}</span>
          <span className="font-semibold">
            {estimate.totalCredits} {t("creditsUnit")}
          </span>
        </div>
        {balance != null && (
          <div className="-mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("runConfirmBalance")}</span>
            <span className={insufficient ? "font-medium text-destructive" : undefined}>
              {balance} {t("creditsUnit")}
            </span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" disabled={insufficient} onClick={onConfirm}>
            {t("runConfirmStart")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
