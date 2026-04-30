"use client";

import {
  Edit, Eye, Trash2, Download, X, CheckSquare, Square, Upload, MoreHorizontal, Sparkles, Heart, ImageOff, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Wallpaper } from "@/types/wallpaper";
import { Loading } from "@/components/ui/loading";
import { ImageWithPlaceholder } from "@/components/ui/image-with-placeholder";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTranslations } from "next-intl";

interface WallpaperCardProps {
  wallpaper: Wallpaper;
  activeTab: string;
  copy: any;
  user: any;
  selectedIds: number[];
  toggleSelect: (id: number) => void;
  handlePreview: (wallpaper: Wallpaper) => void;
  handleRetry: (wallpaper: Wallpaper) => void;
  handleDelete: (id: number) => void;
  handleEdit: (wallpaper: Wallpaper) => void;
  handleUnfavorite: (wallpaper: Wallpaper) => void;
  handleDownload: (id: number, description: string) => void;
  handleUnpublish: (id: number) => void;
  handlePublishClick: (wallpaper: Wallpaper) => void;
}

export function WallpaperCard({
  wallpaper, activeTab, copy, user, selectedIds,
  toggleSelect, handlePreview, handleRetry, handleDelete,
  handleEdit, handleUnfavorite, handleDownload, handleUnpublish, handlePublishClick,
}: WallpaperCardProps) {
  const t = useTranslations("myWorks.card");

  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-white/20 bg-card shadow-xl dark:border-white/10 dark:bg-slate-900">
      <div className="relative aspect-square overflow-hidden">
        {wallpaper.status === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 p-4 text-center">
            <Loading size="md" />
            <p className="mt-2 text-xs text-muted-foreground animate-pulse">{t("generating")}</p>
          </div>
        ) : wallpaper.status === 2 ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 p-4 text-center">
            <div className="rounded-full bg-destructive/10 p-3 mb-3">
              <ImageOff className="h-8 w-8 text-destructive" />
            </div>
            <div className="flex items-center gap-1.5 text-destructive">
              <span className="text-xs font-medium">{t("failed")}</span>
              {wallpaper.failure_reason && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="cursor-pointer flex items-center outline-none" onClick={(e) => e.stopPropagation()}>
                      <AlertCircle className="h-4 w-4 opacity-80 hover:opacity-100 transition-opacity active:scale-95" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="top" 
                    className="max-w-[250px] w-auto p-2.5 text-xs bg-destructive/90 text-destructive-foreground border-none shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="break-words leading-relaxed">{wallpaper.failure_reason}</p>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>
        ) : (
          <div onClick={() => handlePreview(wallpaper)} className="h-full w-full cursor-pointer">
            <ImageWithPlaceholder
              src={wallpaper.img_thumbnail_url || ""}
              alt={wallpaper.img_description || ""}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition duration-700 group-hover:scale-105"
            />
          </div>
        )}

        {wallpaper.status !== 0 && (activeTab !== "published" || user?.roles?.includes("superadmin") || user?.id === wallpaper.user_id) && (
          <div className="absolute left-2 top-2">
            <button
              onClick={(e) => { e.stopPropagation(); toggleSelect(wallpaper.id!); }}
              className="rounded-full bg-black/50 p-1.5 text-white backdrop-blur hover:bg-black/70"
            >
              {selectedIds.includes(wallpaper.id!) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
            </button>
          </div>
        )}

        {wallpaper.aspect_ratio_name && (
          <div className="absolute right-2 top-2">
            <Badge variant="secondary" className="text-xs px-2 py-1 bg-black/50 text-white backdrop-blur border-white/20">
              {wallpaper.aspect_ratio_name}
            </Badge>
          </div>
        )}

        {activeTab === "published" && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white backdrop-blur shadow-sm">
            <Heart className="h-3 w-3" />
            <span>{wallpaper.likes_count || 0}</span>
          </div>
        )}

        {wallpaper.is_public && (
          <div className="absolute bottom-2 left-2 flex items-center rounded bg-primary/80 px-2 py-1 text-xs font-medium text-primary-foreground backdrop-blur shadow-sm">
            {t("published")}
          </div>
        )}
      </div>

      <div className="space-y-2 px-4 pt-4 pb-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground">{wallpaper.img_description}</p>

        <div className="flex items-center justify-between gap-2 mt-2">
          {activeTab === "published" && user?.roles?.includes("superadmin") && wallpaper.created_user ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={wallpaper.created_user.avatar_url || ""} />
                <AvatarFallback>{wallpaper.created_user.nickname?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {wallpaper.created_user.nickname || wallpaper.created_user.email}
              </span>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-1 shrink-0">
            {wallpaper.status === 0 ? (
              <Button variant="ghost" size="sm" disabled className="px-2">
                <MoreHorizontal className="h-4 w-4 opacity-50" />
              </Button>
            ) : wallpaper.status === 2 ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleRetry(wallpaper)} className="px-2 text-primary hover:text-primary/80" title={t("retry")}>
                  <span className="text-xs mr-1">{t("retry")}</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(wallpaper.id!)} className="px-2 text-destructive hover:text-destructive/80">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : activeTab === "favorites" ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(wallpaper)} className="px-2">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>{t("makeSame")}</p></TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="px-2"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePreview(wallpaper)}>
                      <Eye className="mr-2 h-4 w-4" />{copy.card.preview}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUnfavorite(wallpaper)} className="text-destructive focus:text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" />{t("unfavorite")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {activeTab !== "published" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(wallpaper)} className="px-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>{copy.card.edit}</p></TooltipContent>
                  </Tooltip>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="px-2"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePreview(wallpaper)}>
                      <Eye className="mr-2 h-4 w-4" />{copy.card.preview}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(wallpaper.id!, wallpaper.img_description || "")}>
                      <Download className="mr-2 h-4 w-4" />{copy.card.download}
                    </DropdownMenuItem>
                    {activeTab === "published" ? (
                      (user?.roles?.includes("superadmin") || user?.id === wallpaper.user_id) && (
                        <DropdownMenuItem onClick={() => handleUnpublish(wallpaper.id!)} className="text-destructive focus:text-destructive">
                          <X className="mr-2 h-4 w-4" />{copy.card.unpublish}
                        </DropdownMenuItem>
                      )
                    ) : (
                      <DropdownMenuItem onClick={() => handleDelete(wallpaper.id!)} className="text-destructive focus:text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />{copy.card.delete}
                      </DropdownMenuItem>
                    )}
                    {activeTab !== "published" && (
                      <DropdownMenuItem
                        onClick={(e) => { if (wallpaper.is_public) { e.preventDefault(); return; } handlePublishClick(wallpaper); }}
                        disabled={wallpaper.is_public}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {wallpaper.is_public ? t("published") : t("publishToHomepage")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
