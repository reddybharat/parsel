import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  patchClearsDuplicate,
  recomputeRow,
  type EditableImportRow,
} from "@/lib/importReview";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

function eligibleKeys(source: EditableImportRow[]): Set<string> {
  return new Set(source.filter(isRowSelectable).map((row) => String(row.source_row)));
}

export function ImportReviewTable({
  rows,
  categories,
  banks,
  paymentMethods,
  onRowsChange,
  onImport,
  onRemoveRow,
  importing,
}: {
  rows: EditableImportRow[];
  categories: Category[];
  banks: string[];
  paymentMethods: string[];
  onRowsChange: (rows: EditableImportRow[]) => void;
  onImport: (selected: EditableImportRow[]) => void;
  onRemoveRow?: (sourceRow: number) => void;
  importing?: boolean;
}) {
  // Column defs must stay referentially stable: flexRender treats each `cell` as a
  // component type, so rebuilding them per keystroke would remount (and unfocus) the inputs.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
    const initial: RowSelectionState = {};
    for (const key of eligibleKeys(rows)) initial[key] = true;
    return initial;
  });

  // Tracks which rows were eligible last render so rows that *become* ready
  // (a freshly-typed row, or a CSV row fixed inline) auto-select themselves.
  const prevEligibleRef = useRef<Set<string>>(eligibleKeys(rows));

  useEffect(() => {
    const eligible = eligibleKeys(rows);
    // Snapshot before scheduling: the updater below runs during a later render pass,
    // by which point the ref would already hold the new set.
    const previous = prevEligibleRef.current;
    prevEligibleRef.current = eligible;

    setRowSelection((current) => {
      const next: RowSelectionState = {};
      // Keep prior selections that are still eligible.
      for (const [key, selected] of Object.entries(current)) {
        if (selected && eligible.has(key)) next[key] = true;
      }
      // Auto-select rows that just became eligible.
      for (const key of eligible) {
        if (!previous.has(key)) next[key] = true;
      }
      const currentKeys = Object.keys(current).filter((key) => current[key]);
      const nextKeys = Object.keys(next);
      const unchanged =
        currentKeys.length === nextKeys.length && nextKeys.every((key) => current[key]);
      return unchanged ? current : next;
    });
  }, [rows]);

  const patchRow = useCallback(
    (sourceRow: number, patch: Partial<EditableImportRow>) => {
      const next = rowsRef.current.map((row) => {
        if (row.source_row !== sourceRow) return row;
        return recomputeRow({ ...row, ...patchClearsDuplicate(patch) }, categories, banks);
      });
      onRowsChange(next);
    },
    [banks, categories, onRowsChange],
  );

  const approveNewCategory = useCallback(
    (sourceRow: number) => patchRow(sourceRow, { approved_new_category: true }),
    [patchRow],
  );

  const columns = useMemo(
    () =>
      createImportReviewColumns({
        categories,
        paymentMethods,
        onRowChange: patchRow,
        onApproveNewCategory: approveNewCategory,
        onRemoveRow,
      }),
    [categories, paymentMethods, patchRow, approveNewCategory, onRemoveRow],
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
  const duplicateCount = pending.filter((row) => row.is_duplicate && !row.force_duplicate).length;
  const readyCount = pending.filter((row) => isRowSelectable(row)).length;
  const attentionCount = pending.filter(
    (row) => !row.is_ready && !(row.is_duplicate && !row.force_duplicate),
  ).length;
  const approvedCategories = collectApprovedNewCategories(selectedRows);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5 text-xs text-parsel-muted">
          <span>
            {attentionCount > 0
              ? `${attentionCount} need a category or fix · ${readyCount} ready · ${selectedRows.length} selected`
              : `${readyCount} ready · ${selectedRows.length} selected`}
            {duplicateCount > 0
              ? ` · ${duplicateCount} duplicate${duplicateCount === 1 ? "" : "s"} skipped`
              : ""}
            {importedCount > 0 ? ` · ${importedCount} already imported` : ""}
          </span>
          {approvedCategories.length > 0 ? (
            <span className="truncate">
              Will create categories: {approvedCategories.join(", ")}
            </span>
          ) : null}
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
