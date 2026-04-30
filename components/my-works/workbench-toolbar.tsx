import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus } from "lucide-react";

interface WorkbenchToolbarProps {
  selectedCount: number;
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
  const hasFilters = Boolean(keyword || startDate || endDate || sortByLikes);

  return (
    <div className="flex items-center justify-between gap-4 px-2">
      <div className="flex items-center gap-4 text-sm text-muted-foreground whitespace-nowrap">
        <button
          type="button"
          onClick={onToggleSelectAll}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          {selectedCount === totalCount && totalCount > 0
            ? tWorkbench("deselectAll")
            : tWorkbench("selectAllOnPage")}
        </button>
        {totalCount > 0 && <span>{tWorkbench("currentPage", { count: totalCount })}</span>}
      </div>

      <div className="flex items-center gap-2">
        {onOpenGenerate && (
          <Button 
            onClick={onOpenGenerate} 
            size="sm" 
            className="h-9 gap-2 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white hover:opacity-90 border-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{tWorkbench("startCreating", { defaultValue: "Start Creating" })}</span>
            <span className="inline sm:hidden">{tWorkbench("create", { defaultValue: "Create" })}</span>
          </Button>
        )}
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
            {hasFilters && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {[keyword, startDate, endDate, sortByLikes].filter(Boolean).length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">{tWorkbench("filters")}</p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">{tWorkbench("keyword")}</label>
              <Input
                placeholder={tWorkbench("keywordPlaceholder")}
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                className="h-9"
              />
            </div>

            {activeTab === "published" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">{tWorkbench("sortByLikes")}</label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={sortByLikes}
                  onChange={(e) => onSortByLikesChange(e.target.value as "asc" | "desc" | "")}
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
                  onChange={(e) => onStartDateChange(e.target.value)}
                  className="h-9"
                />
                <span className="text-muted-foreground text-center">-</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => onEndDateChange(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={onResetFilters} className="h-9 w-full">
                {tWorkbench("resetFilters")}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
