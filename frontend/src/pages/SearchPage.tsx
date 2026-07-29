import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { InlineProgress } from "../components/feedback/InlineProgress";
import { StatusAlert, type FeedbackMessage } from "../components/feedback/StatusAlert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ConfirmDeleteDialog } from "../components/transactions/ConfirmDeleteDialog";
import { EditTransactionDialog } from "../components/transactions/EditTransactionDialog";
import { TransactionTable } from "../components/transactions/TransactionTable";
import { invalidateDashboardOverview } from "@/lib/dashboardQuery";
import { trackerConfigQueryOptions } from "@/lib/trackerConfigQuery";
import {
  deleteTransaction,
  exportTransactions,
  searchTransactions,
  updateTransaction,
} from "../api/tracker";
import { formatInrSigned, signedAmount } from "../lib/format";
import type { SearchResult, Transaction } from "../lib/types";

const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-parsel-secondary";

type DatePreset = "lastMonth" | "today" | "last7" | "month";

function localDateIso(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStartLocal(): string {
  const d = new Date();
  d.setDate(1);
  return localDateIso(d);
}

function daysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateIso(d);
}

function lastMonthStartLocal(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return localDateIso(d);
}

function lastMonthEndLocal(): string {
  const d = new Date();
  d.setDate(0);
  return localDateIso(d);
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export function SearchPage() {
  const { data: trackerConfig, isPending: loadingConfig } = useQuery(trackerConfigQueryOptions());
  const categories = trackerConfig?.categories ?? [];
  const paymentMethods = trackerConfig?.payment_methods ?? [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Something went wrong");
  const [errorRetry, setErrorRetry] = useState<(() => void) | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  const [startDate, setStartDate] = useState(monthStartLocal());
  const [endDate, setEndDate] = useState(localDateIso());
  const [category, setCategory] = useState("All");
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const [sortColumn, setSortColumn] = useState<"transaction_date" | "amount" | "category" | "payment_method" | "description">(
    "transaction_date",
  );
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const totalPages = useMemo(() => (result ? Math.max(1, Math.ceil(result.total / result.page_size)) : 1), [result]);

  function showError(title: string, description: string, retry?: () => void) {
    setErrorTitle(title);
    setError(description);
    setErrorRetry(retry ? () => retry : null);
  }

  function clearError() {
    setError(null);
    setErrorTitle("Something went wrong");
    setErrorRetry(null);
  }

  function applyPreset(preset: DatePreset) {
    const today = localDateIso();
    if (preset === "lastMonth") {
      setStartDate(lastMonthStartLocal());
      setEndDate(lastMonthEndLocal());
    } else if (preset === "today") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "last7") {
      setStartDate(daysAgoLocal(6));
      setEndDate(today);
    } else {
      setStartDate(monthStartLocal());
      setEndDate(today);
    }
    setActivePreset(preset);
  }

  function onStartDateChange(value: string) {
    setStartDate(value);
    setActivePreset(null);
  }

  function onEndDateChange(value: string) {
    setEndDate(value);
    setActivePreset(null);
  }

  function clearFilters() {
    setStartDate(monthStartLocal());
    setEndDate(localDateIso());
    setCategory("All");
    setActivePreset(null);
  }

  async function runSearch(
    targetPage = page,
    opts?: { sortColumn?: typeof sortColumn; sortDesc?: boolean },
  ) {
    const nextSortColumn = opts?.sortColumn ?? sortColumn;
    const nextSortDesc = opts?.sortDesc ?? sortDesc;
    setLoading(true);
    clearError();
    try {
      const data = await searchTransactions({
        start_date: startDate,
        end_date: endDate,
        category,
        sort_column: nextSortColumn,
        sort_desc: nextSortDesc,
        page: targetPage,
        page_size: PAGE_SIZE,
      });
      setPage(targetPage);
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed.";
      showError("Search failed", message, () => void runSearch(targetPage, opts));
    } finally {
      setLoading(false);
    }
  }

  async function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    await runSearch(1);
  }

  async function onDeleteConfirm() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await deleteTransaction(deleting.id);
      void invalidateDashboardOverview();
      setFeedback({ variant: "success", title: "Transaction deleted" });
      setDeleting(null);
      await runSearch(page);
    } catch (err) {
      showError("Delete failed", err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onEditSave() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateTransaction(editing.id, editing);
      void invalidateDashboardOverview();
      setEditing(null);
      setFeedback({ variant: "success", title: "Transaction updated" });
      await runSearch(page);
    } catch (err) {
      showError("Update failed", err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onExport() {
    try {
      const blob = await exportTransactions({
        start_date: startDate,
        end_date: endDate,
        category,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions_${startDate}_${endDate}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showError("Export failed", err instanceof Error ? err.message : "Export failed.");
    }
  }

  const rangeStart = result ? (result.page - 1) * result.page_size + 1 : 0;
  const rangeEnd = result ? Math.min(result.page * result.page_size, result.total) : 0;
  const pages = result ? pageNumbers(result.page, totalPages) : [];
  const canExport = Boolean(result && result.total > 0);

  return (
    <div className="mx-auto flex h-full w-full max-w-content min-h-0 flex-col gap-1.5 overflow-hidden">
      {feedback ? <StatusAlert {...feedback} onDismiss={() => setFeedback(null)} /> : null}
      {error ? (
        <StatusAlert
          variant="error"
          title={errorTitle}
          description={error}
          onDismiss={clearError}
          action={
            errorRetry ? (
              <Button size="sm" variant="outline" type="button" onClick={() => errorRetry()}>
                Retry
              </Button>
            ) : undefined
          }
        />
      ) : null}

      <form className="space-y-4 rounded-none border border-parsel-border bg-parsel-soft p-4 shadow-none" onSubmit={onSearchSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              className={activePreset === "lastMonth" ? "border-parsel-nav-active-bg bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg" : ""}
              type="button"
              variant={activePreset === "lastMonth" ? "secondary" : "outline"}
              size="sm"
              onClick={() => applyPreset("lastMonth")}
            >
              Last Month
            </Button>
            <Button
              className={activePreset === "today" ? "border-parsel-nav-active-bg bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg" : ""}
              type="button"
              variant={activePreset === "today" ? "secondary" : "outline"}
              size="sm"
              onClick={() => applyPreset("today")}
            >
              Today
            </Button>
            <Button
              className={activePreset === "last7" ? "border-parsel-nav-active-bg bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg" : ""}
              type="button"
              variant={activePreset === "last7" ? "secondary" : "outline"}
              size="sm"
              onClick={() => applyPreset("last7")}
            >
              Last 7 days
            </Button>
            <Button
              className={activePreset === "month" ? "border-parsel-nav-active-bg bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg" : ""}
              type="button"
              variant={activePreset === "month" ? "secondary" : "outline"}
              size="sm"
              onClick={() => applyPreset("month")}
            >
              This month
            </Button>
          </div>
          <Button asChild>
            <Link to="/ledger/add">+ Add Transaction</Link>
          </Button>
        </div>
        <div className="flex items-end gap-3">
          <Field className="w-auto min-w-[170px] flex-1">
            <FieldLabel htmlFor="search-start" className={fieldLabelClass}>
              Start Date
            </FieldLabel>
            <DatePicker id="search-start" value={startDate} onChange={onStartDateChange} placeholder="Start date" />
          </Field>
          <Field className="w-auto min-w-[170px] flex-1">
            <FieldLabel htmlFor="search-end" className={fieldLabelClass}>
              End Date
            </FieldLabel>
            <DatePicker id="search-end" value={endDate} onChange={onEndDateChange} placeholder="End date" />
          </Field>
          <Field className="w-auto min-w-[180px] flex-1">
            <FieldLabel htmlFor="search-category" className={fieldLabelClass}>
              Category
            </FieldLabel>
            <NativeSelect
              id="search-category"
              key={`search-category-${categories.length}-${categories.map((c) => c.name).join("|")}`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <NativeSelectOption value="All">All Categories</NativeSelectOption>
              {loadingConfig && categories.length === 0 ? (
                <NativeSelectOption value="__loading" disabled>
                  Loading categories…
                </NativeSelectOption>
              ) : null}
              {categories.map((item) => (
                <NativeSelectOption key={item.name} value={item.name}>
                  {item.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Button className="shrink-0" type="submit" disabled={loading}>
            Search
          </Button>
          {canExport ? (
            <Button
              className="shrink-0 bg-parsel-emerald hover:bg-parsel-emerald/90"
              type="button"
              onClick={() => void onExport()}
            >
              Export CSV
            </Button>
          ) : null}
        </div>
        {loading ? <InlineProgress label="Searching ledger…" /> : null}
      </form>

      {result && !loading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {result.items.length === 0 ? (
            <div className="rounded-none border border-parsel-border bg-parsel-surface py-20">
              <EmptyState title="No transactions found" detail="Try adjusting your filters." />
              <div className="mt-4 flex justify-center gap-3">
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
                <Button asChild className="bg-parsel-emerald hover:bg-parsel-emerald/90">
                  <Link to="/ledger/add">Add New Entry</Link>
                </Button>
              </div>
            </div>
          ) : (
            <TransactionTable
              items={result.items}
              sortColumn={sortColumn}
              sortDesc={sortDesc}
              onSortChange={(column) => {
                const nextDesc = column === sortColumn ? !sortDesc : true;
                setSortColumn(column);
                setSortDesc(nextDesc);
                void runSearch(1, { sortColumn: column, sortDesc: nextDesc });
              }}
              onEdit={(row) => setEditing(row)}
              onDelete={(row) => setDeleting(row)}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-none border border-parsel-border bg-parsel-soft px-4 py-2.5">
            <p className="text-sm text-parsel-muted">
              Showing {rangeStart}-{rangeEnd} of {result.total} transactions
            </p>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    className={result.page <= 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (result.page > 1) void runSearch(result.page - 1);
                    }}
                  />
                </PaginationItem>
                {pages.map((n, i) => {
                  const prev = pages[i - 1];
                  const showEllipsis = prev !== undefined && n - prev > 1;
                  return (
                    <PaginationItem key={n}>
                      {showEllipsis ? <PaginationEllipsis /> : null}
                      <PaginationLink
                        className="cursor-pointer"
                        href="#"
                        isActive={n === result.page}
                        onClick={(e) => {
                          e.preventDefault();
                          if (n !== result.page) void runSearch(n);
                        }}
                      >
                        {n}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    className={result.page >= totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (result.page < totalPages) void runSearch(result.page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      ) : null}

      <EditTransactionDialog
        open={Boolean(editing)}
        transaction={editing}
        categories={categories}
        paymentMethods={paymentMethods}
        loading={submitting}
        onChange={setEditing}
        onSave={() => void onEditSave()}
        onCancel={() => setEditing(null)}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        loading={submitting}
        itemLabel={deleting ? `${deleting.transaction_date} - ${formatInrSigned(signedAmount(deleting.amount, deleting.is_debit))}` : ""}
        onConfirm={() => void onDeleteConfirm()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
