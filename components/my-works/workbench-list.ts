export const WORKBENCH_GRID_CLASS =
  "grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-3";

export type SelectAllState = "none" | "some" | "all";

export function getSelectAllState(
  selectedCount: number,
  loadedCount: number,
): SelectAllState {
  if (loadedCount <= 0 || selectedCount <= 0) return "none";
  if (selectedCount >= loadedCount) return "all";
  return "some";
}

export function getNextWorksPageParam(
  lastPage: { data?: { wallpapers?: unknown[]; total?: number } } | undefined,
  allPages: Array<{ data?: { wallpapers?: unknown[] } }>,
): number | undefined {
  const loaded = allPages.reduce(
    (count, page) => count + (page?.data?.wallpapers?.length ?? 0),
    0,
  );
  const total = lastPage?.data?.total ?? 0;
  if (loaded === 0 || loaded >= total) return undefined;
  return allPages.length + 1;
}

export function flattenMyWorksPages(
  pages: Array<{ data?: { wallpapers?: any[]; total?: number } }> | undefined,
): { wallpapers: any[]; total: number } {
  const list = pages ?? [];
  return {
    wallpapers: list.flatMap((page) => page?.data?.wallpapers ?? []),
    total: list[0]?.data?.total ?? 0,
  };
}

export function mapMyWorksPages(
  old: { pages?: any[]; pageParams?: any[] } | undefined,
  mapWallpaper: (wallpaper: any) => any,
) {
  if (!old?.pages) return old;
  return {
    ...old,
    pages: old.pages.map((page) => {
      if (!page?.data?.wallpapers) return page;
      return {
        ...page,
        data: {
          ...page.data,
          wallpapers: page.data.wallpapers.map(mapWallpaper),
        },
      };
    }),
  };
}
