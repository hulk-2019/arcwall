"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sparkles, Heart, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wallpaper } from "@/types/wallpaper";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";
import { useDesignStore } from "@/store/useDesignStore";
import { useRouter } from "next/navigation";
import { ImageWithPlaceholder } from "@/components/ui/image-with-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { useMutation } from "@tanstack/react-query";
import { toggleFavorite } from "@/services/api";
import { WallpaperPreviewDialog } from "@/components/ui/wallpaper-preview-dialog";
import { useTranslations } from "next-intl";

interface Props {
  wallpapers: Wallpaper[] | null;
  loading: boolean;
}

export default function WallpapersGrid({ wallpapers, loading }: Props) {
  const t = useTranslations("trending");
  const tPreview = useTranslations("myWorks");
  const { setPrompt, setModel, setAspectRatio, setImgPath, setImgUrl } = useDesignStore();
  const { user } = useAppStore();
  const router = useRouter();

  const handleMakeSame = (wallpaper: Wallpaper) => {
    if (!user) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/")}`);
      return;
    }
    setPrompt(wallpaper.img_description);
    if (wallpaper.model_key) setModel(wallpaper.model_key);
    if (wallpaper.aspect_ratio_key) setAspectRatio(wallpaper.aspect_ratio_key);
    if (wallpaper.llm_params?.imgPath) {
      const imgPath = wallpaper.llm_params.imgPath;
      setImgPath(Array.isArray(imgPath) ? imgPath : [imgPath]);
      setImgUrl(null);
    } else {
      setImgPath(null);
      setImgUrl(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [favoritingId, setFavoritingId] = useState<number | null>(null);
  const [localFavorites, setLocalFavorites] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const favs: Record<number, boolean> = {};
    wallpapers?.forEach((w) => { if (w.id && w.is_favorite) favs[w.id] = true; });
    setLocalFavorites(favs);
  }, [wallpapers]);

  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
    onSuccess: (data: any, variables: { wallpaperId: number }) => {
      if (data.code === 0) {
        const id = variables.wallpaperId;
        if (id) setLocalFavorites((prev) => ({ ...prev, [id]: data.data.is_favorite }));
        return;
      }
      toast.error(t("failedToFavorite"));
    },
    onError: () => {
      toast.error(t("networkError"));
    },
    onSettled: () => setFavoritingId(null),
  });

  const handleFavorite = (e: React.MouseEvent, wallpaper: Wallpaper) => {
    e.stopPropagation();
    if (!user) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent("/")}`);
      return;
    }
    if (!wallpaper.id) return;
    setFavoritingId(wallpaper.id);
    favoriteMutation.mutate({ wallpaperId: wallpaper.id });
  };

  const getAspectRatio = (ratioName?: string) => {
    if (!ratioName) return "3/4";
    try {
      const [w, h] = ratioName.split(":").map(Number);
      if (w && h) return `${w}/${h}`;
    } catch { return "3/4"; }
    return "3/4";
  };

  const [cols, setCols] = useState(2);
  useEffect(() => {
    const updateCols = () => {
      if (window.innerWidth >= 1536) setCols(7);
      else if (window.innerWidth >= 1280) setCols(6);
      else if (window.innerWidth >= 1024) setCols(4);
      else if (window.innerWidth >= 768) setCols(3);
      else setCols(2);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const columnsData = Array.from({ length: cols }, () => ({
    items: [] as { wallpaper: Wallpaper; idx: number }[],
    height: 0,
  }));

  wallpapers?.forEach((wp, idx) => {
    let ratio = 3 / 4;
    if (wp.aspect_ratio_name) {
      const [w, h] = wp.aspect_ratio_name.split(":").map(Number);
      if (w && h) ratio = w / h;
    }
    const heightEst = 1 / ratio;
    let minColIdx = 0;
    let minHeight = columnsData[0].height;
    for (let i = 1; i < cols; i++) {
      if (columnsData[i].height < minHeight) { minHeight = columnsData[i].height; minColIdx = i; }
    }
    columnsData[minColIdx].items.push({ wallpaper: wp, idx });
    columnsData[minColIdx].height += heightEst;
  });

  return (
    <TooltipProvider>
      <section id="trending" className="w-full space-y-8 pb-20 pt-10">
        {loading ? (
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-4 flex-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="w-full rounded-xl" style={{ aspectRatio: i % 2 === 0 ? "3/4" : "1/1" }} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-4">
            {columnsData.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-4 flex-1">
                {col.items.map(({ wallpaper, idx }) => (
                  <article
                    key={`${wallpaper.id ?? wallpaper.img_url}-${idx}`}
                    className="group relative break-inside-avoid overflow-hidden rounded-xl bg-muted shadow-sm transition-all hover:shadow-lg cursor-pointer"
                    style={{ aspectRatio: getAspectRatio(wallpaper.aspect_ratio_name) }}
                    onClick={() => setPreviewIndex(idx)}
                  >
                    <ImageWithPlaceholder
                      src={wallpaper.img_thumbnail_url || ""}
                      alt={wallpaper.img_description}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    
                    <div className="absolute top-3 right-3 left-3 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-white shrink-0"
                        onClick={(e) => handleFavorite(e, wallpaper)}
                        disabled={favoritingId === wallpaper.id}
                      >
                        <Heart className={`h-4 w-4 ${localFavorites[wallpaper.id as number] ? "fill-red-500 text-red-500" : "text-white"}`} />
                      </Button>
                      <div className="flex gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-white shrink-0"
                              onClick={(e) => { e.stopPropagation(); setPreviewIndex(idx); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{tPreview("card.preview")}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/10 text-white hover:text-white shrink-0"
                              onClick={(e) => { e.stopPropagation(); handleMakeSame(wallpaper); }}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>{t("makeSame")}</p></TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 z-10 flex items-end justify-between">
                      {wallpaper.aspect_ratio_name ? (
                        <Badge variant="secondary" className="bg-black/40 text-white backdrop-blur-md border border-white/10 text-[10px] h-5 px-2">
                          {wallpaper.aspect_ratio_name}
                        </Badge>
                      ) : <div />}
                      
                      <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full py-1 pr-2 pl-1" onClick={(e) => e.stopPropagation()}>
                        <Avatar className="h-5 w-5 border border-white/20">
                          <AvatarImage src={wallpaper.created_user?.avatar_url || ""} />
                          <AvatarFallback className="text-[10px] bg-primary/40 text-white">
                            {(wallpaper.created_user?.nickname || "momo").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] text-white/90 font-medium truncate max-w-[80px]">
                          {wallpaper.created_user?.nickname || "momo"}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
      {wallpapers && previewIndex !== null && (
        <WallpaperPreviewDialog
          wallpaper={wallpapers[previewIndex] ?? null}
          onClose={() => setPreviewIndex(null)}
          promptLabel={tPreview("preview.prompt")}
          currentIndex={previewIndex}
          totalCount={wallpapers.length}
          onPrev={() => setPreviewIndex((prev) => prev === null ? prev : prev === 0 ? wallpapers.length - 1 : prev - 1)}
          onNext={() => setPreviewIndex((prev) => prev === null ? prev : prev === wallpapers.length - 1 ? 0 : prev + 1)}
          renderActions={(wallpaper) => (
            <Button
              className="w-full rounded-full gap-2 font-semibold"
              onClick={() => { handleMakeSame(wallpaper); setPreviewIndex(null); }}
            >
              <Sparkles className="h-4 w-4" />
              {t("makeSame")}
            </Button>
          )}
        />
      )}
    </TooltipProvider>
  );
}
