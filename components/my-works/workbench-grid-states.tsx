import { Globe, Heart, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { WORKBENCH_GRID_CLASS } from "@/components/my-works/workbench-list";

export function WorkbenchGridSkeleton() {
  return (
    <div className={WORKBENCH_GRID_CLASS}>
      {Array.from({ length: 12 }).map((_, index) => (
        <article
          key={index}
          className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="space-y-2 px-3 py-2.5">
            <Skeleton className="h-4 w-2/3" />
            <div className="mt-2 flex justify-end gap-2">
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
  const Icon = activeTab === "favorites" ? Heart : activeTab === "published" ? Globe : ImageIcon;

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/60 px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      <h3 className="text-lg font-medium">
        {activeTab === "favorites"
          ? tWorkbench("emptyFavoritesTitle")
          : activeTab === "published"
            ? tWorkbench("emptyPublishedTitle")
            : tWorkbench("emptyCreationsTitle")}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {activeTab === "favorites"
          ? tWorkbench("emptyFavoritesDesc")
          : activeTab === "published"
            ? tWorkbench("emptyPublishedDesc")
            : tWorkbench("emptyCreationsDesc")}
      </p>
    </div>
  );
}
