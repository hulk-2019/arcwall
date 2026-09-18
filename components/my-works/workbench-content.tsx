"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDesignStore } from "@/store/useDesignStore";
import { useAppStore } from "@/store/useAppStore";
import { Wallpaper } from "@/types/wallpaper";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  subscribeGenStatus,
} from "@/services/api";

import { BatchActions } from "@/components/my-works/batch-actions";
import { WallpaperCard } from "@/components/my-works/wallpaper-card";
import { PreviewDialog } from "@/components/my-works/preview-dialog";
import { WorkbenchToolbar } from "@/components/my-works/workbench-toolbar";
import { GeneratePanel } from "@/components/generate-panel";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  WorkbenchEmptyState,
  WorkbenchGridSkeleton,
} from "@/components/my-works/workbench-grid-states";
import {
  WORKBENCH_GRID_CLASS,
  flattenMyWorksPages,
  getNextWorksPageParam,
  mapMyWorksPages,
} from "@/components/my-works/workbench-list";
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
  const { user, fetchUserCredits } = useAppStore();
  const router = useRouter();
  const tMyWorks = useTranslations("myWorks");
  const tWorkbench = useTranslations("myWorks.workbench");
  const locale = useLocale();
  const copy = {
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

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [previewWallpaper, setPreviewWallpaper] = useState<Wallpaper | null>(
    null,
  );
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

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
    limit,
    debouncedKeyword,
    startDate,
    endDate,
    sortByLikes,
  ];

  const {
    data: myWorksData,
    isLoading: loading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      try {
        return await getMyWorks({
          page: pageParam,
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
    getNextPageParam: (lastPage, allPages) => getNextWorksPageParam(lastPage, allPages),
  });

  const { wallpapers, total } = flattenMyWorksPages(myWorksData?.pages);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const hasPending = activeTab === "creations" && wallpapers.some((w) => w.status === 0);

  useEffect(() => {
    if (!hasPending) return;

    const unsubscribe = subscribeGenStatus({
      onUpdate: (updated) => {
        queryClient.setQueryData(queryKey, (old: any) => {
          const updatedMap = new Map(updated.map((w: any) => [w.id, w]));
          return mapMyWorksPages(old, (w: any) =>
            updatedMap.has(w.id) ? { ...w, ...updatedMap.get(w.id) } : w,
          );
        });
      },
      onDone: () => {
        queryClient.invalidateQueries({ queryKey });
      },
      onError: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    });

    return unsubscribe;
  }, [hasPending, queryKey.join(",")]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, debouncedKeyword, startDate, endDate, sortByLikes]);

  const wallpaperIdsKey = wallpapers.map((w) => w.id).join(",");

  useEffect(() => {
    const currentIds = new Set(
      wallpapers
        .map((w) => w.id!)
        .filter((id): id is number => id !== undefined),
    );
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => currentIds.has(id));
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, [wallpaperIdsKey]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const root = node.closest("[data-workbench-scroll]");
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { root: root instanceof Element ? root : null, rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, wallpapers.length]);

  const handleEdit = async (wallpaper: Wallpaper) => {
    setPrompt(wallpaper.img_description || "");
    if (wallpaper.model_key) setModel(wallpaper.model_key);
    if (wallpaper.aspect_ratio_key) setAspectRatio(wallpaper.aspect_ratio_key);

    if (wallpaper.llm_params && wallpaper.llm_params.imgPath) {
      const imgPath = wallpaper.llm_params.imgPath;
      setImgPath(Array.isArray(imgPath) ? imgPath : [imgPath]);
      setImgUrl(null); // Clear previous URL to trigger re-sign in Hero
    } else {
      setImgUrl(null);
      setImgPath(null);
    }

    setIsGenerateDialogOpen(true);
  };

  const retryMutation = useMutation({
    mutationFn: genWallpaper,
    onMutate: async (variables: any) => {
      // Optimistically update status to generating
      queryClient.setQueryData(queryKey, (old: any) =>
        mapMyWorksPages(old, (w: any) =>
          w.id === variables.optimisticId ? { ...w, status: 0 } : w,
        ),
      );
    },
    onSuccess: (res: any) => {
      if (res.code === 0) {
        fetchUserCredits();
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

  return (
    <TooltipProvider>
      <div>
        <div className="sticky top-0 z-20 bg-background/95 shadow-[0_8px_20px_-12px_hsl(var(--foreground)/0.22)] backdrop-blur">
          <div className="w-full px-2 py-2 md:px-3">
            <WorkbenchToolbar
              selectedCount={selectedIds.length}
              loadedCount={wallpapers.length}
              totalCount={total}
              activeTab={activeTab}
              keyword={keyword}
              startDate={startDate}
              endDate={endDate}
              sortByLikes={sortByLikes}
              tWorkbench={tWorkbench}
              onToggleSelectAll={toggleSelectAll}
              onKeywordChange={setKeyword}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onSortByLikesChange={setSortByLikes}
              onResetFilters={() => {
                setStartDate("");
                setEndDate("");
                setSortByLikes("");
              }}
              onOpenGenerate={() => setIsGenerateDialogOpen(true)}
            />
          </div>
        </div>

        <div className="w-full space-y-3 px-2 py-3 md:px-3">
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

        {loading ? (
          <WorkbenchGridSkeleton />
        ) : wallpapers.length === 0 ? (
          <WorkbenchEmptyState activeTab={activeTab} tWorkbench={tWorkbench} />
        ) : (
          <>
            <div className={WORKBENCH_GRID_CLASS}>
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

            <div
              ref={loadMoreRef}
              className={`flex min-h-8 items-center justify-center ${selectedIds.length > 0 ? "pb-36 sm:pb-28" : "pb-4"}`}
            >
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {tWorkbench("loadingMore")}
                </div>
              ) : null}
            </div>
          </>
        )}
        </div>
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

      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl p-0 bg-transparent border-0 shadow-none sm:rounded-lg [&>button]:top-4 [&>button]:right-4 [&>button]:text-gray-500 hover:[&>button]:text-gray-900 dark:[&>button]:text-gray-400 dark:hover:[&>button]:text-gray-100 [&>button]:z-50 [&>button]:bg-white/80 dark:[&>button]:bg-black/50 [&>button]:p-1 [&>button]:rounded-md backdrop-blur-sm">
          <DialogTitle className="sr-only">Generate Wallpaper</DialogTitle>
          <DialogDescription className="sr-only">Create a new wallpaper</DialogDescription>
          <GeneratePanel 
            className="border-0 ring-0 m-0" 
            onSuccess={() => {
              setIsGenerateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey });
            }}
          />
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
