import { Skeleton } from "@/components/ui/skeleton";

export function WorkbenchGridSkeleton() {
  return (
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
  );
}

interface WorkbenchEmptyStateProps {
  activeTab: "creations" | "published" | "favorites";
  tWorkbench: (key: string) => string;
}

export function WorkbenchEmptyState({ activeTab, tWorkbench }: WorkbenchEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
      <div className="p-6 bg-muted/50 rounded-full">
        <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  );
}
