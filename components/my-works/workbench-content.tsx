"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore } from "@/store/useDesignStore";
import { useAppStore } from "@/store/useAppStore";
import { useUser } from "@clerk/nextjs";
import { Wallpaper } from "@/types/wallpaper";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMyWorks,
  genWallpaper,
  deleteMyWork,
  batchDeleteMyWorks,
  unpublishWallpaper,
  toggleFavorite,
  batchUnfavorite,
  publishWallpaper,
  getWallpaperUrls,
} from "@/services/api";

import { BatchActions } from "@/components/my-works/batch-actions";
import { WallpaperCard } from "@/components/my-works/wallpaper-card";
import { PreviewDialog } from "@/components/my-works/preview-dialog";
import { useTranslations, useLocale } from "next-intl";

interface WorkbenchContentProps {
  activeTab: "creations" | "published" | "favorites";
}

export function WorkbenchContent({ activeTab }: WorkbenchContentProps) {
  const {
    setPrompt,
    setModel,
    setAspectRatio,
    setImgUrl,
    setImgPath,
  } = useDesignStore();
  const { user, fetchUserInfo } = useAppStore();
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const tMyWorks = useTranslations("myWorks");
  const tWorkbench = useTranslations("myWorks.workbench");
  const locale = useLocale();
  const copy = {
    pagination: {
      previous: tMyWorks("pagination.previous"),
      next: tMyWorks("pagination.next"),
      page: tMyWorks("pagination.page"),
    },
    batch: {
      selected: tMyWorks("batch.selected"),
      deleteSelected: tMyWorks("batch.deleteSelected"),
      downloadSelected: tMyWorks("batch.downloadSelected"),
      cancel: tMyWorks("batch.cancel"),
      unpublishSelected: tMyWorks("batch.unpublishSelected"),
    },
    card: {
      edit: tMyWorks("card.edit"),
      preview: tMyWorks("card.preview"),
      delete: tMyWorks("card.delete"),
      download: tMyWorks("card.download"),
      more: tMyWorks("card.more"),
      unpublish: tMyWorks("card.unpublish"),
    },
    preview: {
      aspectRatio: tMyWorks("preview.aspectRatio"),
      resolution: tMyWorks("preview.resolution"),
      prompt: tMyWorks("preview.prompt"),
      model: tMyWorks("preview.model"),
      close: tMyWorks("preview.close"),
    },
  };

  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewWallpaper, setPreviewWallpaper] = useState<Wallpaper | null>(
    null,
  );
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Filters
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortByLikes, setSortByLikes] = useState<"asc" | "desc" | "">("");

  const limit = 12;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
    }, 500);
    return () => clearTimeout(handler);
  }, [keyword]);

  const queryKey = [
    "myWorks",
    activeTab,
    page,
    limit,
    debouncedKeyword,
    startDate,
    endDate,
    sortByLikes,
  ];

  const { data: myWorksData, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await getMyWorks({
          page,
          limit,
          type: activeTab,
          keyword: debouncedKeyword || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sortByLikes: sortByLikes || undefined,
        });
      } catch (e: any) {
        if (e.message?.includes("401")) {
          router.push("/sign-in");
        } else {
          toast.error(tWorkbench("failedToLoadWallpapers"));
        }
        throw e;
      }
    },
    refetchInterval: (query) => {
      const currentWallpapers = query.state.data?.data?.wallpapers || [];
      if (
        activeTab === "creations" &&
        currentWallpapers.some((w: any) => w.status === 0)
      ) {
        return 3000;
      }
      return false;
    },
  });

  const wallpapers: Wallpaper[] = myWorksData?.data?.wallpapers || [];
  const total = myWorksData?.data?.total || 0;

  // Keep selected IDs in sync with current page wallpapers
  useEffect(() => {
    const currentWallpapers: Wallpaper[] = myWorksData?.data?.wallpapers || [];
    const currentIds = new Set(
      currentWallpapers
        .map((w) => w.id!)
        .filter((id): id is number => id !== undefined),
    );
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => currentIds.has(id));
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, [myWorksData?.data?.wallpapers]);

  const handleEdit = async (wallpaper: Wallpaper) => {
    setPrompt(wallpaper.img_description || "");
    if (wallpaper.model_key) setModel(wallpaper.model_key);
    if (wallpaper.aspect_ratio_key) setAspectRatio(wallpaper.aspect_ratio_key);

    if (wallpaper.llm_params && wallpaper.llm_params.imgPath) {
      const imgPath = wallpaper.llm_params.imgPath;
      setImgPath(imgPath);
      setImgUrl(null); // Clear previous URL to trigger re-sign in Hero
    } else {
      setImgUrl(null);
      setImgPath(null);
    }

    router.push("/");
  };

  const retryMutation = useMutation({
    mutationFn: genWallpaper,
    onMutate: async (variables: any) => {
      // Optimistically update status to generating
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.data?.wallpapers) return old;
        return {
          ...old,
          data: {
            ...old.data,
            wallpapers: old.data.wallpapers.map((w: any) =>
              w.id === variables.optimisticId ? { ...w, status: 0 } : w,
            ),
          },
        };
      });
    },
    onSuccess: (res: any) => {
      if (res.code === 0) {
        fetchUserInfo(isSignedIn, isLoaded);
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(tWorkbench("retryFailed"));
    },
    onError: () => {
      toast.error(tWorkbench("retryFailed"));
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const handleRetry = (wallpaper: Wallpaper) => {
    if (!wallpaper.llm_params) return;
    retryMutation.mutate({
      description: wallpaper.img_description,
      aspectRatio: wallpaper.aspect_ratio_key,
      model: wallpaper.model_key,
      language: locale,
      optimisticId: wallpaper.id,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: deleteMyWork,
    onSuccess: (res: any, id: number) => {
      if (res.code === 0) {
        setSelectedIds(selectedIds.filter((i) => i !== id));
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(tWorkbench("deleteFailed"));
    },
    onError: () => {
      toast.error(tWorkbench("deleteFailed"));
    },
  });

  const handleDelete = (id: number) => {
    if (
      !confirm(tWorkbench("confirmDelete"))
    ) {
      return;
    }
    deleteMutation.mutate(id);
  };

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteMyWorks,
    onSuccess: (res: any) => {
      if (res.code === 0) {
        setSelectedIds([]);
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(tWorkbench("batchDeleteFailed"));
    },
    onError: () => {
      toast.error(tWorkbench("batchDeleteFailed"));
    },
  });

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = tWorkbench("confirmBatchDelete", { count: selectedIds.length });
    if (!confirm(confirmMsg)) {
      return;
    }
    batchDeleteMutation.mutate(selectedIds);
  };

  const handlePublishClick = (wallpaper: Wallpaper) => {
    if (
      !confirm(tWorkbench("confirmPublish"))
    ) {
      return;
    }
    publishMutation.mutate({
      wallpaperId: wallpaper.id as number,
    });
  };

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => {
      if (activeTab === "published") {
        return unpublishWallpaper({ systemWallpaperId: id });
      }
      return unpublishWallpaper({ wallpaperId: id });
    },
    onSuccess: (res: any, id: number) => {
      if (res.code === 0) {
        setSelectedIds(selectedIds.filter((i) => i !== id));
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(tWorkbench("unpublishFailed"));
    },
    onError: () => {
      toast.error(tWorkbench("unpublishFailed"));
    },
  });

  const handleUnpublish = (id: number) => {
    if (
      !confirm(tWorkbench("confirmUnpublish"))
    ) {
      return;
    }
    unpublishMutation.mutate(id);
  };

  const favoriteMutation = useMutation({
    mutationFn: toggleFavorite,
    onSuccess: (res: any, variables: any) => {
      if (res.code === 0 && !res.data.is_favorite) {
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(
        tWorkbench("toggleFavoriteFailed"),
      );
    },
    onError: () => {
      toast.error(tWorkbench("networkError"));
    },
  });

  const handleUnfavorite = (wallpaper: Wallpaper) => {
    if (!wallpaper.id) return;
    favoriteMutation.mutate({
      wallpaperId: wallpaper.id,
    });
  };

  const batchUnfavoriteMutation = useMutation({
    mutationFn: (ids: number[]) => batchUnfavorite({ wallpaperIds: ids }),
    onSuccess: (successCount) => {
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error(tWorkbench("batchUnfavoriteFailed"));
    },
  });

  const handleBatchUnfavorite = () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = tWorkbench("confirmBatchUnfavorite", { count: selectedIds.length });
    if (!confirm(confirmMsg)) return;

    batchUnfavoriteMutation.mutate(selectedIds);
  };

  const batchUnpublishMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const params =
        activeTab === "published"
          ? { systemWallpaperIds: ids }
          : { wallpaperIds: ids };

      const res = await unpublishWallpaper(params);
      if (res.code === 0) {
        return res.data?.count || ids.length;
      }
      throw new Error(res.message || "unpublish.failed");
    },
    onSuccess: (successCount) => {
      toast.success(tWorkbench("batchUnpublishedSuccess", { count: successCount }));
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error(tWorkbench("batchUnpublishFailed"));
    },
  });

  const handleBatchUnpublish = () => {
    if (selectedIds.length === 0) return;
    const confirmMsg = tWorkbench("confirmBatchUnpublish", { count: selectedIds.length });
    if (!confirm(confirmMsg)) return;

    batchUnpublishMutation.mutate(selectedIds);
  };

  const publishMutation = useMutation({
    mutationFn: publishWallpaper,
    onSuccess: (res: any) => {
      if (res.code === 0) {
        toast.success(tWorkbench("publishedSuccess"));
        queryClient.invalidateQueries({ queryKey });
        return;
      }
      toast.error(tWorkbench("publishFailed"));
    },
    onError: () => {
      toast.error(tWorkbench("publishFailed"));
    },
  });

  const batchPublishMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await publishWallpaper({ wallpaperIds: ids });
      if (res.code === 0) {
        return res.data?.count || ids.length;
      }
      throw new Error(res.message || "publish.failed");
    },
    onSuccess: (successCount) => {
      toast.success(tWorkbench("batchPublishedSuccess", { count: successCount }));
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast.error(tWorkbench("publishFailed"));
    },
  });

  const handleBatchPublish = () => {
    if (selectedIds.length === 0) return;

    // Check if any of the selected wallpapers are not eligible (already published, generating, failed)
    const eligibleIds = selectedIds.filter((id) => {
      const wp = wallpapers.find((w) => w.id === id);
      return wp && wp.status === 1 && !wp.is_public;
    });

    if (eligibleIds.length === 0) {
      toast.error(tWorkbench("noEligibleWorks"));
      return;
    }

    const confirmMsg = tWorkbench("confirmBatchPublish", { count: eligibleIds.length });
    if (!confirm(confirmMsg)) return;

    batchPublishMutation.mutate(eligibleIds);
  };

  const downloadMutation = useMutation({
    mutationFn: getWallpaperUrls,
    onSuccess: (res: any, variables: any) => {
      if (res.data && res.data.url) {
        const link = document.createElement("a");
        link.href = res.data.url;
        link.download = `${variables.description}.png`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        toast.error(
          tWorkbench("failedToGenerateDownloadUrl"),
        );
      }
    },
    onError: () => {
      toast.error(tWorkbench("downloadFailed"));
    },
  });

  const handleDownload = async (id: number, description: string) => {
    const params: any = {
      type: "download",
      description,
    };
    if (activeTab === "published") {
      params.systemWallpaperId = id;
    } else {
      params.wallpaperId = id;
    }
    downloadMutation.mutate(params);
  };

  const handleBatchDownload = async () => {
    for (const id of selectedIds) {
      const wallpaper = wallpapers.find((w) => w.id === id);
      if (wallpaper) {
        await handleDownload(wallpaper.id!, wallpaper.img_description || "");
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  };

  const handlePreview = async (wallpaper: Wallpaper) => {
    setPreviewWallpaper(wallpaper);
    setPreviewIndex(wallpapers.findIndex((w) => w.id === wallpaper.id));
    setPreviewImageUrl(null);
    try {
      const params: any = {
        type: "preview",
      };
      if (activeTab === "published") {
        params.systemWallpaperId = wallpaper.id as number;
      } else {
        params.wallpaperId = wallpaper.id as number;
      }

      const res = await getWallpaperUrls(params);
      if (res.code === 0 && res.data && res.data.url) {
        setPreviewImageUrl(res.data.url);
      }
    } catch (e) {
      console.log("load preview image failed: ", e);
    }
  };

  const handlePreviewNavigate = async (nextIndex: number) => {
    const nextWallpaper = wallpapers[nextIndex];
    if (!nextWallpaper) return;

    setPreviewIndex(nextIndex);
    setPreviewWallpaper(nextWallpaper);
    setPreviewImageUrl(null);

    try {
      const params: any = {
        type: "preview",
      };
      if (activeTab === "published") {
        params.systemWallpaperId = nextWallpaper.id as number;
      } else {
        params.wallpaperId = nextWallpaper.id as number;
      }

      const res = await getWallpaperUrls(params);
      if (res.code === 0 && res.data && res.data.url) {
        setPreviewImageUrl(res.data.url);
      }
    } catch (e) {
      console.log("load preview image failed: ", e);
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const toggleSelectAll = () => {
    const selectableWallpapers =
      activeTab === "published" && !user?.roles?.includes("superadmin")
        ? wallpapers.filter((w) => w.user_id === user?.id)
        : wallpapers;

    if (
      selectedIds.length === selectableWallpapers.length &&
      selectableWallpapers.length > 0
    ) {
      setSelectedIds([]);
    } else {
      setSelectedIds(
        selectableWallpapers
          .map((w) => w.id!)
          .filter((id): id is number => id !== undefined),
      );
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Batch Toolbar and Filters */}
        <div className="flex items-center justify-between gap-4 px-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground whitespace-nowrap">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {selectedIds.length === wallpapers.length && wallpapers.length > 0
                ? tWorkbench("deselectAll")
                : tWorkbench("selectAllOnPage")}
            </button>
            {wallpapers.length > 0 && (
              <span>{tWorkbench("currentPage", { count: wallpapers.length })}</span>
            )}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="8" x2="16" y1="12" y2="12" />
                  <line x1="11" x2="13" y1="18" y2="18" />
                </svg>
                {tWorkbench("filter")}
                {(keyword || startDate || endDate || sortByLikes) && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {
                      [keyword, startDate, endDate, sortByLikes].filter(Boolean)
                        .length
                    }
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="flex flex-col gap-4">
                <p className="text-sm font-medium">
                  {tWorkbench("filters")}
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    {tWorkbench("keyword")}
                  </label>
                  <Input
                    placeholder={tWorkbench("keywordPlaceholder")}
                    value={keyword}
                    onChange={(e) => {
                      setKeyword(e.target.value);
                      setPage(1);
                    }}
                    className="h-9"
                  />
                </div>

                {activeTab === "published" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-muted-foreground">
                      {tWorkbench("sortByLikes")}
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={sortByLikes}
                      onChange={(e) => {
                        setSortByLikes(e.target.value as "asc" | "desc" | "");
                        setPage(1);
                      }}
                    >
                      <option value="">{tWorkbench("sortDefault")}</option>
                      <option value="desc">{tWorkbench("sortDesc")}</option>
                      <option value="asc">{tWorkbench("sortAsc")}</option>
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">
                    {tWorkbench("dateRange")}
                  </label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setPage(1);
                      }}
                      className="h-9"
                    />
                    <span className="text-muted-foreground text-center">-</span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setPage(1);
                      }}
                      className="h-9"
                    />
                  </div>
                </div>

                {(keyword || startDate || endDate || sortByLikes) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setKeyword("");
                      setStartDate("");
                      setEndDate("");
                      setSortByLikes("");
                      setPage(1);
                    }}
                    className="h-9 w-full"
                  >
                    {tWorkbench("resetFilters")}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Batch Actions */}
        <BatchActions
          selectedIds={selectedIds}
          activeTab={activeTab}
          copy={copy}
          isUnpublishing={batchUnpublishMutation.isPending}
          setSelectedIds={setSelectedIds}
          handleBatchDownload={handleBatchDownload}
          handleBatchUnpublish={handleBatchUnpublish}
          handleBatchUnfavorite={handleBatchUnfavorite}
          handleBatchDelete={handleBatchDelete}
          handleBatchPublish={handleBatchPublish}
        />

        {/* Wallpapers Grid */}
        {loading ? (
          <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <article
                key={i}
                className="overflow-hidden rounded-[28px] border border-white/20 bg-card shadow-xl dark:border-white/10 dark:bg-slate-900"
              >
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
        ) : wallpapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
            <div className="p-6 bg-muted/50 rounded-full">
              <svg
                className="w-12 h-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
            <h3 className="text-xl font-medium">
              {activeTab === "favorites"
                ? tWorkbench("emptyFavoritesTitle")
                : activeTab === "published"
                  ? tWorkbench("emptyPublishedTitle")
                  : tWorkbench("emptyCreationsTitle")}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {activeTab === "favorites"
                ? tWorkbench("emptyFavoritesDesc")
                : activeTab === "published"
                  ? tWorkbench("emptyPublishedDesc")
                  : tWorkbench("emptyCreationsDesc")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {wallpapers.map((wallpaper) => (
                <WallpaperCard
                  key={wallpaper.id}
                  wallpaper={wallpaper}
                  activeTab={activeTab}
                  copy={copy}
                  user={user}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  handlePreview={handlePreview}
                  handleRetry={handleRetry}
                  handleDelete={handleDelete}
                  handleEdit={handleEdit}
                  handleUnfavorite={handleUnfavorite}
                  handleDownload={handleDownload}
                  handleUnpublish={handleUnpublish}
                  handlePublishClick={handlePublishClick}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-6">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {copy.pagination.previous}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {copy.pagination.page} {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {copy.pagination.next}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialogs */}
      <PreviewDialog
        previewWallpaper={previewWallpaper}
        previewImageUrl={previewImageUrl}
        activeTab={activeTab}
        copy={copy}
        setPreviewWallpaper={(wallpaper) => {
          setPreviewWallpaper(wallpaper);
          if (!wallpaper) setPreviewIndex(null);
        }}
        handleDownload={handleDownload}
        handleEdit={handleEdit}
        handleUnfavorite={handleUnfavorite}
        handleDelete={handleDelete}
        currentIndex={previewIndex ?? undefined}
        totalCount={wallpapers.length}
        onPrev={() => {
          if (!wallpapers.length) return;
          const base = previewIndex ?? 0;
          const next = base === 0 ? wallpapers.length - 1 : base - 1;
          handlePreviewNavigate(next);
        }}
        onNext={() => {
          if (!wallpapers.length) return;
          const base = previewIndex ?? 0;
          const next = base === wallpapers.length - 1 ? 0 : base + 1;
          handlePreviewNavigate(next);
        }}
      />
    </TooltipProvider>
  );
}
