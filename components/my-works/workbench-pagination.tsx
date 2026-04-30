import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkbenchPaginationProps {
  page: number;
  totalPages: number;
  previousText: string;
  nextText: string;
  pageText: string;
  onPrev: () => void;
  onNext: () => void;
}

export function WorkbenchPagination({
  page,
  totalPages,
  previousText,
  nextText,
  pageText,
  onPrev,
  onNext,
}: WorkbenchPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 pt-6">
      <Button variant="outline" disabled={page === 1} onClick={onPrev}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        {previousText}
      </Button>
      <span className="text-sm text-muted-foreground">
        {pageText} {page} / {totalPages}
      </span>
      <Button variant="outline" disabled={page >= totalPages} onClick={onNext}>
        {nextText}
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
