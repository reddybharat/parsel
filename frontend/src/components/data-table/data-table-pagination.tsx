import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

const PAGE_SIZES = [15, 25, 50];

export function DataTablePagination<TData>({
  table,
  children,
}: {
  table: Table<TData>;
  children?: ReactNode;
}) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const total = table.getRowCount();
  const pageCount = table.getPageCount();
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-t-0 border-parsel-border bg-parsel-soft px-3 py-2">
      <div className="flex min-w-0 items-center gap-3 text-xs text-parsel-muted">
        {children ?? (
          <span className="tabular-nums">
            {total === 0 ? "No transactions" : `${rangeStart}–${rangeEnd} of ${total}`}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-parsel-muted">
          <span className="hidden sm:inline">Rows</span>
          <NativeSelect
            size="xs"
            className="w-16"
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <NativeSelectOption key={size} value={String(size)}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>

        <span className="text-xs tabular-nums text-parsel-muted">
          Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </span>

        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-parsel-muted hover:text-parsel-text disabled:opacity-30"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="First page"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-parsel-muted hover:text-parsel-text disabled:opacity-30"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-parsel-muted hover:text-parsel-text disabled:opacity-30"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-parsel-muted hover:text-parsel-text disabled:opacity-30"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Last page"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
