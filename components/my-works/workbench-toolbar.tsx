import { CheckSquare, Filter, MinusSquare, Plus, Search, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getSelectAllState } from "@/components/my-works/workbench-list";

interface WorkbenchToolbarProps {
  selectedCount: number;
  loadedCount: number;
  totalCount: number;
  activeTab: "creations" | "published" | "favorites";
  keyword: string;
  startDate: string;
  endDate: string;
  sortByLikes: "asc" | "desc" | "";
  tWorkbench: (key: string, values?: Record<string, any>) => string;
  onToggleSelectAll: () => void;
  onKeywordChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onSortByLikesChange: (value: "asc" | "desc" | "") => void;
  onResetFilters: () => void;
  onOpenGenerate?: () => void;
}

export function WorkbenchToolbar({
  selectedCount,
  loadedCount,
  totalCount,
  activeTab,
  keyword,
  startDate,
  endDate,
  sortByLikes,
  tWorkbench,
  onToggleSelectAll,
  onKeywordChange,
  onStartDateChange,
  onEndDateChange,
  onSortByLikesChange,
  onResetFilters,
  onOpenGenerate,
}: WorkbenchToolbarProps) {
  const extraFilterCount = [startDate, endDate, sortByLikes].filter(Boolean).length;
  const selectAllState = getSelectAllState(selectedCount, loadedCount);
  const SelectIcon =
    selectAllState === "all" ? CheckSquare : selectAllState === "some" ? MinusSquare : Square;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={
            selectAllState === "all" ? "true" : selectAllState === "some" ? "mixed" : "false"
          }
          onClick={onToggleSelectAll}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SelectIcon className="h-4 w-4" aria-hidden />
          {selectAllState === "all" ? tWorkbench("deselectAll") : tWorkbench("selectAll")}
        </button>
        {loadedCount > 0 && (
          <span className="hidden whitespace-nowrap text-sm text-muted-foreground md:inline">
            {tWorkbench("loadedCount", { loaded: loadedCount, total: totalCount })}
          </span>
        )}
        <div className="relative w-52 sm:w-64 md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            placeholder={tWorkbench("keywordPlaceholder")}
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            className="h-9 rounded-md border-border bg-muted/50 pl-9"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 rounded-md px-3">
              <Filter className="h-4 w-4" aria-hidden />
              {tWorkbench("filter")}
              {extraFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-sm bg-primary px-1 text-[10px] text-primary-foreground">
                  {extraFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] sm:w-80" align="end">
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium">{tWorkbench("filters")}</p>

              {activeTab === "published" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">{tWorkbench("sortByLikes")}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={sortByLikes}
                    onChange={(event) => onSortByLikesChange(event.target.value as "asc" | "desc" | "")}
                  >
                    <option value="">{tWorkbench("sortDefault")}</option>
                    <option value="desc">{tWorkbench("sortDesc")}</option>
                    <option value="asc">{tWorkbench("sortAsc")}</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{tWorkbench("dateRange")}</label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => onStartDateChange(event.target.value)}
                    className="h-9"
                  />
                  <span className="text-center text-muted-foreground">-</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => onEndDateChange(event.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {extraFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-9 w-full">
                  {tWorkbench("resetFilters")}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        {onOpenGenerate && (
          <Button type="button" onClick={onOpenGenerate} className="h-9 rounded-md px-4">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{tWorkbench("startCreating")}</span>
            <span className="sm:hidden">{tWorkbench("create")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
