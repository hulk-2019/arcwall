import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface BatchActionsProps {
  selectedIds: number[];
  activeTab: string;
  copy: any;
  isUnpublishing: boolean;
  setSelectedIds: (ids: number[]) => void;
  handleBatchDownload: () => void;
  handleBatchUnpublish: () => void;
  handleBatchUnfavorite: () => void;
  handleBatchDelete: () => void;
  handleBatchPublish: () => void;
}

export function BatchActions({
  selectedIds,
  activeTab,
  copy,
  isUnpublishing,
  setSelectedIds,
  handleBatchDownload,
  handleBatchUnpublish,
  handleBatchUnfavorite,
  handleBatchDelete,
  handleBatchPublish,
}: BatchActionsProps) {
  const t = useTranslations("myWorks.batch");
  if (selectedIds.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3 md:bottom-6 md:left-56">
      <div className="pointer-events-auto flex w-fit max-w-[calc(100%-0.5rem)] flex-wrap items-center justify-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur sm:flex-nowrap sm:gap-3 sm:px-4">
        <span className="px-1 text-sm font-medium text-foreground">
          {copy.batch.selected}: {selectedIds.length}
        </span>
        {activeTab !== "favorites" && (
          <Button variant="outline" size="sm" onClick={handleBatchDownload}>
            {copy.batch.downloadSelected}
          </Button>
        )}
        {activeTab === "creations" && (
          <Button variant="outline" size="sm" onClick={handleBatchPublish}>
            {t("batchPublish")}
          </Button>
        )}
        {activeTab === "published" ? (
          <Button variant="destructive" size="sm" disabled={isUnpublishing} onClick={handleBatchUnpublish}>
            {isUnpublishing ? t("processing") : copy.batch.unpublishSelected}
          </Button>
        ) : activeTab === "favorites" ? (
          <Button variant="destructive" size="sm" onClick={handleBatchUnfavorite}>
            {t("unfavorite")}
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
            {copy.batch.deleteSelected}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="text-muted-foreground">
          {copy.batch.cancel}
        </Button>
      </div>
    </div>
  );
}
