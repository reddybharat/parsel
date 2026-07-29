import { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type RowSelectionState,
} from "@tanstack/react-table";

import { DataTable } from "@/components/data-table/data-table";
import { createImportReviewColumns } from "@/components/transactions/importReviewColumns";
import { Button } from "@/components/ui/button";
import {
  collectApprovedNewCategories,
  isRowSelectable,
  recomputeRow,
  type EditableImportRow,
} from "@/lib/importReview";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ImportReviewTable({
  rows,
  categories,
  paymentMethods,
  onRowsChange,
  onImport,
  importing,
}: {
  rows: EditableImportRow[];
  categories: Category[];
  paymentMethods: string[];
  onRowsChange: (rows: EditableImportRow[]) => void;
  onImport: (selected: EditableImportRow[]) => void;
  importing?: boolean;
}) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
    const initial: RowSelectionState = {};
    for (const row of rows) {
      if (isRowSelectable(row)) {
        initial[String(row.source_row)] = true;
      }
    }
    return initial;
  });

  // Rows that became ineligible (edited into an error, or just imported) drop out of the selection.
  useEffect(() => {
    setRowSelection((current) => {
      const eligible = new Set(rows.filter(isRowSelectable).map((row) => String(row.source_row)));
      const next: RowSelectionState = {};
      let changed = false;
      for (const [key, selected] of Object.entries(current)) {
        if (selected && eligible.has(key)) {
          next[key] = true;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [rows]);

  function patchRow(sourceRow: number, patch: Partial<EditableImportRow>) {
    const next = rows.map((row) => {
      if (row.source_row !== sourceRow) return row;
      return recomputeRow({ ...row, ...patch }, categories);
    });
    onRowsChange(next);
  }

  function approveNewCategory(sourceRow: number) {
    patchRow(sourceRow, { approved_new_category: true });
  }

  const columns = useMemo(
    () =>
      createImportReviewColumns({
        categories,
        paymentMethods,
        onRowChange: patchRow,
        onApproveNewCategory: approveNewCategory,
      }),
    [categories, paymentMethods, rows],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => String(row.source_row),
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => isRowSelectable(row.original),
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const selectedRows = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
    .filter(isRowSelectable);

  const importedCount = rows.filter((row) => row.imported).length;
  const pending = rows.filter((row) => !row.imported);
  const readyCount = pending.filter((row) => row.is_ready).length;
  const attentionCount = pending.length - readyCount;
  const approvedCategories = collectApprovedNewCategories(selectedRows, categories);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5 text-xs text-parsel-muted">
          <span>
            {rows.length} row{rows.length === 1 ? "" : "s"} · {readyCount} ready · {attentionCount}{" "}
            need attention · {selectedRows.length} selected
            {importedCount > 0 ? ` · ${importedCount} imported` : ""}
          </span>
          <span className="truncate">
            New categories to create: {approvedCategories.join(", ") || "none"}
          </span>
        </div>
        <Button
          type="button"
          disabled={selectedRows.length === 0 || importing}
          onClick={() => onImport(selectedRows)}
        >
          {importing ? "Importing…" : `Import ${selectedRows.length} selected`}
        </Button>
      </div>

      <DataTable
        table={table}
        // Fixed layout so the per-column widths hold instead of being resized by cell content.
        // Top-aligned cells keep inputs on one line when a row shows an inline error below a field.
        // Tighter gutters than the read-only tables: every cell here holds a control already padded.
        className={cn(
          "min-h-0 flex-1 [&_table]:table-fixed",
          "[&_th]:h-8 [&_th]:px-1.5 [&_td]:px-1.5 [&_td]:py-1.5 [&_td]:align-top",
          "[&_th:first-child]:pl-3 [&_td:first-child]:pl-3",
          "[&_th:last-child]:pr-3 [&_td:last-child]:pr-3",
        )}
        empty={
          <div className="px-6 py-12 text-center text-sm text-parsel-muted">
            No rows parsed from this file.
          </div>
        }
      />
    </div>
  );
}
