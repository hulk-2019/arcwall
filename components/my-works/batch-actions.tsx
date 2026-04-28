import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

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
    <div className="fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full border border-border/50 bg-background/95 px-6 py-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <span className="text-sm font-medium">
        {copy.batch.selected}: {selectedIds.length}
      </span>
      <div className="flex gap-2">
        {activeTab !== 'favorites' && (
          <Button variant="outline" size="sm" onClick={handleBatchDownload} className="rounded-full">
            {copy.batch.downloadSelected}
          </Button>
        )}
        {activeTab === 'creations' && (
          <Button variant="outline" size="sm" onClick={handleBatchPublish} className="rounded-full">
            {t("batchPublish")}
          </Button>
        )}
        {activeTab === 'published' ? (
          <Button variant="destructive" size="sm" disabled={isUnpublishing} onClick={handleBatchUnpublish} className="rounded-full">
            {isUnpublishing ? t("processing") : copy.batch.unpublishSelected}
          </Button>
        ) : activeTab === 'favorites' ? (
          <Button variant="destructive" size="sm" onClick={handleBatchUnfavorite} className="rounded-full">
            {t("unfavorite")}
          </Button>
        ) : (
          <Button variant="destructive" size="sm" onClick={handleBatchDelete} className="rounded-full">
            {copy.batch.deleteSelected}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])} className="rounded-full">
          {copy.batch.cancel}
        </Button>
      </div>
    </div>
  );
}
