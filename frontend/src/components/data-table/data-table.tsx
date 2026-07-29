import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import "./table-meta";

export function DataTable<TData>({
  table,
  isLoading = false,
  isRefreshing = false,
  skeletonRows = 8,
  empty,
  className,
}: {
  table: TanstackTable<TData>;
  /** First load with nothing to show yet — render skeleton rows. */
  isLoading?: boolean;
  /** A later fetch while a previous page is still on screen. */
  isRefreshing?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  className?: string;
}) {
  const visibleColumns = table.getVisibleLeafColumns();
  const rows = table.getRowModel().rows;

  return (
    <div
      className={cn(
        "relative min-h-0 flex-1 overflow-auto border border-parsel-border bg-parsel-surface",
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none sticky top-0 z-20 h-px overflow-hidden transition-opacity duration-200",
          isRefreshing ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="data-table-progress h-px w-full bg-parsel-primary" />
      </div>

      <Table className="border-separate border-spacing-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : header.column.getCanSort()
                          ? "none"
                          : undefined
                  }
                  style={{ width: header.column.columnDef.meta?.width }}
                  className={cn(
                    "sticky top-0 z-10 h-9 border-b border-parsel-border bg-parsel-soft px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-parsel-muted",
                    header.column.columnDef.meta?.align === "right" && "text-right",
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`} className="border-0 hover:bg-transparent">
                {visibleColumns.map((column) => (
                  <TableCell key={column.id} className="border-b border-parsel-border px-3 py-2">
                    <div
                      className="h-3 bg-parsel-soft"
                      style={{ width: column.columnDef.meta?.skeletonWidth ?? "60%" }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell colSpan={visibleColumns.length} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="group border-0 transition-colors hover:bg-parsel-soft/60 data-[state=selected]:bg-parsel-soft"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "border-b border-parsel-border px-3 py-2 text-[13px] text-parsel-text",
                      cell.column.columnDef.meta?.align === "right" && "text-right",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
