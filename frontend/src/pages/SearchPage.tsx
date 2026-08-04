import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCoreRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { StatusAlert, type FeedbackMessage } from "@/components/feedback/StatusAlert";
import { AddTransactionDrawer } from "@/components/transactions/AddTransactionDrawer";
import { ConfirmDeleteDialog } from "@/components/transactions/ConfirmDeleteDialog";
import { EditTransactionDialog } from "@/components/transactions/EditTransactionDialog";
import { createLedgerColumns } from "@/components/transactions/ledgerColumns";
import { localDateIso, monthStartLocal } from "@/components/transactions/LedgerDateRange";
import { LedgerToolbar, type LedgerFilters } from "@/components/transactions/LedgerToolbar";
import { Button } from "@/components/ui/button";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { banksQueryOptions } from "@/lib/banksQuery";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { formatInrSigned, signedAmount } from "@/lib/format";
import { trackerConfigQueryOptions } from "@/lib/trackerConfigQuery";
import {
  invalidateTransactionSearch,
  transactionSearchQueryOptions,
} from "@/lib/transactionSearchQuery";
import {
  deleteTransaction,
  exportTransactions,
  updateTransaction,
  type SearchParams,
  type SortColumn,
} from "@/api/tracker";
import type { Transaction } from "@/lib/types";

function defaultFilters(category = ""): LedgerFilters {
  return {
    startDate: monthStartLocal(),
    endDate: localDateIso(),
    query: "",
    category,
    paymentMethod: "",
    bank: "",
    direction: "",
  };
}

export function SearchPage() {
  const [urlParams] = useSearchParams();
  const initialCategory = urlParams.get("category")?.trim() ?? "";
  const { data: trackerConfig } = useQuery(trackerConfigQueryOptions());
  const categories = trackerConfig?.categories ?? [];
  const paymentMethods = trackerConfig?.payment_methods ?? [];
  // Entry uses active banks; filtering + editing history use all profile banks.
  const activeBanks = trackerConfig?.banks ?? [];
  const { data: profileBanks } = useQuery(banksQueryOptions());
  const allBanks = (profileBanks ?? []).map((b) => b.bank);

  const [filters, setFilters] = useState<LedgerFilters>(() => defaultFilters(initialCategory));
  // Idle until the first explicit search; then filter changes refetch live.
  // Deep links with a category should search immediately.
  const [hasSearched, setHasSearched] = useState(() => Boolean(initialCategory));

  useEffect(() => {
    const nextCategory = urlParams.get("category")?.trim() ?? "";
    if (!nextCategory) return;
    setFilters((current) =>
      current.category === nextCategory ? current : { ...current, category: nextCategory },
    );
    setHasSearched(true);
  }, [urlParams]);

  const [sorting, setSorting] = useState<SortingState>([{ id: "transaction_date", desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 15 });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(filters.query, 300);
  const invalidRange = filters.startDate > filters.endDate;

  const searchParams: SearchParams = useMemo(
    () => ({
      start_date: filters.startDate,
      end_date: filters.endDate,
      q: debouncedQuery.trim() || undefined,
      category: filters.category || undefined,
      payment_method: filters.paymentMethod || undefined,
      bank: filters.bank || undefined,
      is_debit: filters.direction === "" ? undefined : filters.direction === "debit",
      sort_column: (sorting[0]?.id ?? "transaction_date") as SortColumn,
      sort_desc: sorting[0]?.desc ?? true,
      page: pagination.pageIndex + 1,
      page_size: pagination.pageSize,
    }),
    [
      filters.startDate,
      filters.endDate,
      filters.category,
      filters.paymentMethod,
      filters.bank,
      filters.direction,
      debouncedQuery,
      sorting,
      pagination.pageIndex,
      pagination.pageSize,
    ],
  );

  const { data, isPending, isFetching, isError, error, refetch } = useQuery(
    transactionSearchQueryOptions(searchParams, hasSearched && !invalidRange),
  );

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const isDirty = useMemo(() => {
    const base = defaultFilters();
    return (
      filters.startDate !== base.startDate ||
      filters.endDate !== base.endDate ||
      filters.query !== "" ||
      filters.category !== "" ||
      filters.paymentMethod !== "" ||
      filters.bank !== "" ||
      filters.direction !== ""
    );
  }, [filters]);

  const hasNarrowingFilters =
    filters.query !== "" ||
    filters.category !== "" ||
    filters.paymentMethod !== "" ||
    filters.bank !== "" ||
    filters.direction !== "";

  const resetPage = useCallback(() => {
    setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }));
  }, []);

  const onFiltersChange = useCallback(
    (next: Partial<LedgerFilters>) => {
      setFilters((current) => ({ ...current, ...next }));
      resetPage();
    },
    [resetPage],
  );

  const onReset = useCallback(() => {
    setFilters(defaultFilters());
    resetPage();
  }, [resetPage]);

  const columns = useMemo(
    () => createLedgerColumns({ onEdit: setEditing, onDelete: setDeleting }),
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: total > 0 ? Math.ceil(total / pagination.pageSize) : 0,
    rowCount: total,
    enableSortingRemoval: false,
    state: { sorting, pagination, columnVisibility },
    onSortingChange: (updater) => {
      setSorting(updater);
      resetPage();
    },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
  });

  function runSearch() {
    if (invalidRange) return;
    if (hasSearched) {
      void refetch();
    } else {
      setHasSearched(true);
    }
  }

  async function withMutation(action: () => Promise<void>, failureTitle: string) {
    setSubmitting(true);
    setActionError(null);
    try {
      await action();
      await invalidateTransactionSearch();
      void invalidateDashboardOverview();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `${failureTitle}.`);
    } finally {
      setSubmitting(false);
    }
  }

  async function onEditSave() {
    if (!editing) return;
    const target = editing;
    await withMutation(async () => {
      await updateTransaction(target.id, target);
      setEditing(null);
      setFeedback({ variant: "success", title: "Transaction updated" });
    }, "Update failed");
  }

  async function onDeleteConfirm() {
    if (!deleting) return;
    const target = deleting;
    await withMutation(async () => {
      await deleteTransaction(target.id);
      setDeleting(null);
      setFeedback({ variant: "success", title: "Transaction deleted" });
    }, "Delete failed");
  }

  async function onExport() {
    try {
      const blob = await exportTransactions({
        start_date: searchParams.start_date,
        end_date: searchParams.end_date,
        q: searchParams.q,
        category: searchParams.category,
        payment_method: searchParams.payment_method,
        bank: searchParams.bank,
        is_debit: searchParams.is_debit,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${searchParams.start_date}_${searchParams.end_date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  const showTable = hasSearched && !invalidRange;
  const firstLoad = showTable && isPending;

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-1.5 overflow-hidden">
      {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}
      {actionError ? (
        <StatusAlert
          variant="error"
          title="Something went wrong"
          description={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      {isError ? (
        <StatusAlert
          variant="error"
          title="Search failed"
          description={error instanceof Error ? error.message : "Could not load transactions."}
          action={
            <Button size="sm" variant="outline" type="button" onClick={() => void refetch()}>
              Retry
            </Button>
          }
        />
      ) : null}

      <LedgerToolbar
        filters={filters}
        onFiltersChange={onFiltersChange}
        onReset={onReset}
        isDirty={isDirty}
        invalidRange={invalidRange}
        categories={categories}
        paymentMethods={paymentMethods}
        banks={allBanks}
        table={table}
        onExport={() => void onExport()}
        canExport={total > 0}
        onSubmit={runSearch}
        onAdd={() => setAddOpen(true)}
      />

      <AddTransactionDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        categories={categories}
        paymentMethods={paymentMethods}
        banks={activeBanks}
        onSaved={() => {
          void invalidateTransactionSearch();
          setFeedback({ variant: "success", title: "Transaction saved" });
        }}
      />

      {showTable ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <DataTable
            table={table}
            isLoading={firstLoad}
            isRefreshing={isFetching && !firstLoad}
            skeletonRows={Math.min(pagination.pageSize, 10)}
            empty={
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <p className="text-sm text-parsel-text">
                  {hasNarrowingFilters ? "No transactions match these filters" : "Nothing recorded in this range"}
                </p>
                <p className="max-w-sm text-xs text-parsel-muted">
                  {hasNarrowingFilters
                    ? "Widen the date range or clear a filter to see more."
                    : "Pick a wider date range, or add your first entry for these dates."}
                </p>
                <div className="mt-1 flex gap-1.5">
                  {isDirty ? (
                    <Button variant="outline" size="sm" onClick={onReset}>
                      Reset filters
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={isDirty ? "ghost" : "default"}
                    onClick={() => setAddOpen(true)}
                  >
                    Add transaction
                  </Button>
                </div>
              </div>
            }
          />
          <DataTablePagination table={table} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 border border-parsel-border bg-parsel-surface px-6 text-center">
          <Search className="size-5 text-parsel-muted" aria-hidden />
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold text-parsel-text">Search your ledger</h2>
            <p className="max-w-sm text-xs text-parsel-muted">
              {invalidRange
                ? "The start date is after the end date. Fix the range to search."
                : "Set a date range and filters above, then run the search. Results update as you refine them."}
            </p>
          </div>
          <Button size="sm" onClick={runSearch} disabled={invalidRange}>
            Search ledger
          </Button>
        </div>
      )}

      <EditTransactionDialog
        open={Boolean(editing)}
        transaction={editing}
        categories={categories}
        paymentMethods={paymentMethods}
        banks={allBanks}
        loading={submitting}
        onChange={setEditing}
        onSave={() => void onEditSave()}
        onCancel={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        loading={submitting}
        itemLabel={
          deleting
            ? `${deleting.transaction_date} — ${formatInrSigned(signedAmount(deleting.amount, deleting.is_debit))}`
            : ""
        }
        onConfirm={() => void onDeleteConfirm()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
