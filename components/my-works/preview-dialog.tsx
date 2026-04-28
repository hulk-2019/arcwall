import { Download, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WallpaperPreviewDialog } from "@/components/ui/wallpaper-preview-dialog";
import { Wallpaper } from "@/types/wallpaper";
import { useTranslations } from "next-intl";

interface PreviewDialogProps {
  previewWallpaper: Wallpaper | null;
  previewImageUrl: string | null;
  activeTab: string;
  copy: any;
  setPreviewWallpaper: (wallpaper: Wallpaper | null) => void;
  handleDownload: (id: number, description: string) => void;
  handleEdit: (wallpaper: Wallpaper) => void;
  handleUnfavorite: (wallpaper: Wallpaper) => void;
  handleDelete: (id: number) => void;
  currentIndex?: number;
  totalCount?: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PreviewDialog({
  previewWallpaper,
  previewImageUrl,
  activeTab,
  copy,
  setPreviewWallpaper,
  handleDownload,
  handleEdit,
  handleUnfavorite,
  handleDelete,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
}: PreviewDialogProps) {
  const tCard = useTranslations("myWorks.card");

  return (
    <WallpaperPreviewDialog
      wallpaper={previewWallpaper}
      imageUrl={previewImageUrl}
      onClose={() => setPreviewWallpaper(null)}
      promptLabel={copy.preview.prompt}
      modelLabel={copy.preview.model}
      aspectRatioLabel={copy.preview.aspectRatio}
      resolutionLabel={copy.preview.resolution}
      currentIndex={currentIndex}
      totalCount={totalCount}
      onPrev={onPrev}
      onNext={onNext}
      renderActions={(wallpaper) => (
        <>
          {activeTab !== "favorites" && (
            <Button
              variant="outline"
              onClick={() => handleDownload(wallpaper.id!, wallpaper.img_description || "")}
              className="flex-1"
            >
              <Download className="mr-2 h-4 w-4" />
              {copy.card.download}
            </Button>
          )}
          {activeTab === "favorites" && (
            <Button
              variant="outline"
              onClick={() => { setPreviewWallpaper(null); handleEdit(wallpaper); }}
              className="flex-1"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {tCard("makeSame")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setPreviewWallpaper(null);
              if (activeTab === "favorites") handleUnfavorite(wallpaper);
              else handleDelete(wallpaper.id!);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    />
  );
}
