"use client";

import { Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithPlaceholder } from "@/components/ui/image-with-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallpaper } from "@/types/wallpaper";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrash, restoreTrash, deleteTrash, clearTrash } from "@/services/api";
import { WORKBENCH_GRID_CLASS } from "@/components/my-works/workbench-list";
import { useTranslations } from "next-intl";

export default function TrashPage() {
  const t = useTranslations("trash");
  const queryClient = useQueryClient();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["trash"],
    queryFn: () => getTrash({}),
  });

  const trash: Wallpaper[] = data?.data || [];

  const restoreMutation = useMutation({
    mutationFn: restoreTrash,
    onSuccess: (res: any) => {
      if (res.code === 0) { queryClient.invalidateQueries({ queryKey: ["trash"] }); return; }
      toast.error(t("restoreFailed"));
    },
    onError: () => toast.error(t("restoreFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrash,
    onSuccess: (res: any) => {
      if (res.code === 0) { queryClient.invalidateQueries({ queryKey: ["trash"] }); return; }
      toast.error(t("deleteFailed"));
    },
    onError: () => toast.error(t("deleteFailed")),
  });

  const handleDelete = (id: number) => {
    if (!confirm(t("confirmDelete"))) return;
    deleteMutation.mutate(id);
  };

  const clearMutation = useMutation({
    mutationFn: clearTrash,
    onSuccess: (res: any) => {
      if (res.code === 0) { queryClient.invalidateQueries({ queryKey: ["trash"] }); return; }
      toast.error(t("clearTrashFailed"));
    },
    onError: () => toast.error(t("clearTrashFailed")),
  });

  const handleClearAll = () => {
    const confirmText = "DELETE";
    const input = prompt(t("confirmClearPrompt", { confirmText }));
    if (input !== confirmText) {
      if (input !== null) toast.error(t("confirmFailed"));
      return;
    }
    clearMutation.mutate();
  };

  return (
    <div>
      {trash.length > 0 && (
        <div className="sticky top-0 z-20 bg-background/95 shadow-[0_8px_20px_-12px_hsl(var(--foreground)/0.22)] backdrop-blur">
          <div className="flex w-full items-center justify-end px-2 py-2 md:px-3">
            <Button variant="destructive" onClick={handleClearAll}>
              {t("clearAll")}
            </Button>
          </div>
        </div>
      )}

      <div className="w-full px-2 py-3 md:px-3">
      {loading ? (
        <div className={WORKBENCH_GRID_CLASS}>
          {Array.from({ length: 12 }).map((_, index) => (
            <article key={index} className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
                <div className="mt-2 flex justify-end gap-2">
                  <Skeleton className="h-8 w-20 rounded-md" />
                  <Skeleton className="h-8 w-20 rounded-md" />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : trash.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-muted">
            <Trash2 className="h-7 w-7 text-muted-foreground" aria-hidden />
          </div>
          <h3 className="text-lg font-medium">{t("emptyTitle")}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className={WORKBENCH_GRID_CLASS}>
          {trash.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="relative aspect-square overflow-hidden">
                <ImageWithPlaceholder
                  src={item.img_thumbnail_url || ""}
                  alt={item.img_description}
                  fill
                  sizes="300px"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col justify-between space-y-3 p-4">
                <div>
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{item.img_description}</p>
                  {item.model_name && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="secondary" className="px-1.5 text-[10px]">{item.model_name}</Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-stretch gap-2 pt-1 sm:flex-row sm:items-center">
                  <Button variant="outline" size="sm" className="flex-1 rounded-md px-2 text-xs sm:px-3" onClick={() => restoreMutation.mutate(item.id!)}>
                    <RotateCcw className="mr-1 h-3 w-3 shrink-0" />
                    <span className="truncate">{t("restore")}</span>
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1 rounded-md px-2 text-xs sm:px-3" onClick={() => handleDelete(item.id!)}>
                    <Trash2 className="mr-1 h-3 w-3 shrink-0" />
                    <span className="truncate">{t("delete")}</span>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
