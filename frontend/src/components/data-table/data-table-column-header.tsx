import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/** Sortable header; arrow only shows for the active column or on hover. */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}) {
  const alignRight = column.columnDef.meta?.align === "right";

  if (!column.getCanSort()) {
    return <span className={cn("uppercase", className)}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting()}
      aria-label={`Sort by ${title}`}
      className={cn(
        "group/sort -mx-1 inline-flex items-center gap-1 px-1 py-0.5 uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        sorted ? "text-parsel-text" : "hover:text-parsel-text",
        alignRight && "flex-row-reverse",
        className,
      )}
    >
      {title}
      <span aria-hidden className="flex size-3 items-center justify-center">
        {sorted === "asc" ? (
          <ArrowUp className="size-3" strokeWidth={2.5} />
        ) : sorted === "desc" ? (
          <ArrowDown className="size-3" strokeWidth={2.5} />
        ) : (
          <ArrowDown className="size-3 opacity-0 transition-opacity group-hover/sort:opacity-40" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}
