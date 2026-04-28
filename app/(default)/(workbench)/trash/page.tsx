"use client";

import { useRouter } from "next/navigation";
import { Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ImageWithPlaceholder } from "@/components/ui/image-with-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallpaper } from "@/types/wallpaper";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrash, restoreTrash, deleteTrash, clearTrash } from "@/services/api";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <div className="flex gap-2">
          {trash.length > 0 && (
            <Button variant="destructive" onClick={handleClearAll}>{t("clearAll")}</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <article key={i} className="overflow-hidden rounded-[28px] border border-white/20 bg-card shadow-xl dark:border-white/10 dark:bg-slate-900">
              <Skeleton className="aspect-square w-full rounded-none" />
              <div className="space-y-2 px-4 pt-4 pb-3">
                <Skeleton className="h-4 w-2/3" />
                <div className="flex justify-end gap-2 mt-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : trash.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-32 h-32 mb-6 opacity-20 bg-muted rounded-full flex items-center justify-center">
            <Trash2 className="w-16 h-16" />
          </div>
          <h3 className="text-xl font-medium mb-2">{t("emptyTitle")}</h3>
          <p className="text-muted-foreground">{t("emptyDesc")}</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {trash.map((item) => (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-xl border border-white/20 bg-card shadow-sm dark:border-white/10 dark:bg-slate-900 flex flex-col grayscale transition-all hover:grayscale-0 hover:shadow-md"
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
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div>
                  <p className="line-clamp-2 text-sm font-medium text-foreground opacity-80">{item.img_description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px] px-1.5 opacity-70">{item.model_name}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => restoreMutation.mutate(item.id!)}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {t("restore")}
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={() => handleDelete(item.id!)}>
                    <Trash2 className="mr-1 h-3 w-3" />
                    {t("delete")}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
