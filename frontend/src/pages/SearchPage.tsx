import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { LoadingState } from "../components/feedback/LoadingState";
import { FieldLabel } from "../components/ui/FieldLabel";
import { ConfirmDeleteDialog } from "../components/transactions/ConfirmDeleteDialog";
import { EditTransactionDialog } from "../components/transactions/EditTransactionDialog";
import { TransactionTable } from "../components/transactions/TransactionTable";
import {
  deleteTransaction,
  exportTransactions,
  fetchTrackerConfig,
  searchTransactions,
  updateTransaction,
} from "../api/tracker";
import { formatInrSigned, signedAmount } from "../lib/format";
import type { SearchResult, Transaction } from "../lib/types";

type DatePreset = "today" | "last7" | "month";

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

const PRESET_ACTIVE = "rounded-full border border-[#bdd3f8] bg-[#dbe9ff] px-3 py-1.5 text-xs font-semibold text-[#2457b8]";
const PRESET_IDLE = "rounded-full border border-[#e1e6ef] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b6472] hover:bg-[#f8fafd]";

function pageNumbers(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  return [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
}

export function SearchPage() {
  const [categories, setCategories] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  useEffect(() => {
    void (async () => {
      try {
        const config = await fetchTrackerConfig();
        setCategories(config.categories);
        setPaymentMethods(config.payment_methods);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load tracker config.");
      }
    })();
  }, []);

  function applyPreset(preset: DatePreset) {
    const today = localDateIso();
    if (preset === "today") {
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
    setError(null);
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
      setError(err instanceof Error ? err.message : "Search failed.");
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
      setStatusMessage("Transaction deleted.");
      setDeleting(null);
      await runSearch(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onEditSave() {
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateTransaction(editing.id, editing);
      setEditing(null);
      setStatusMessage("Transaction updated.");
      await runSearch(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
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
      setError(err instanceof Error ? err.message : "Export failed.");
    }
  }

  const rangeStart = result ? (result.page - 1) * result.page_size + 1 : 0;
  const rangeEnd = result ? Math.min(result.page * result.page_size, result.total) : 0;
  const pages = result ? pageNumbers(result.page, totalPages) : [];
  const canExport = Boolean(result && result.total > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-[#f3c4c4] bg-[#fdecec] px-4 py-2 text-sm text-[#c44747]">
          <span>Failed to fetch data. Please try again.</span>
          <button className="rounded bg-white px-3 py-1 text-xs font-semibold" onClick={() => void runSearch(page)}>
            Retry
          </button>
        </div>
      ) : null}

      <form className="space-y-4 rounded-2xl border border-[#d9e0ea] bg-[#f8fafd] p-4 shadow-sm" onSubmit={onSearchSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              className={activePreset === "today" ? PRESET_ACTIVE : PRESET_IDLE}
              type="button"
              onClick={() => applyPreset("today")}
            >
              Today
            </button>
            <button
              className={activePreset === "last7" ? PRESET_ACTIVE : PRESET_IDLE}
              type="button"
              onClick={() => applyPreset("last7")}
            >
              Last 7 days
            </button>
            <button
              className={activePreset === "month" ? PRESET_ACTIVE : PRESET_IDLE}
              type="button"
              onClick={() => applyPreset("month")}
            >
              This month
            </button>
          </div>
          <Link
            to="/ledger/add"
            className="rounded-lg bg-parsel-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            + Add Transaction
          </Link>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[170px]">
            <FieldLabel>Start Date</FieldLabel>
            <input
              className="h-10 rounded-lg border border-[#d7deea] bg-white px-3 text-sm"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          <div className="min-w-[170px]">
            <FieldLabel>End Date</FieldLabel>
            <input
              className="h-10 rounded-lg border border-[#d7deea] bg-white px-3 text-sm"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <FieldLabel>Category</FieldLabel>
            <select className="h-10 rounded-lg border border-[#d7deea] bg-white px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button className="h-10 rounded-lg bg-parsel-primary px-4 text-sm font-semibold text-white shadow-sm" type="submit" disabled={loading}>
            Search
          </button>
          <span className="ml-auto text-xs text-parsel-muted"></span>
          {canExport ? (
            <button
              className="inline-flex h-10 items-center gap-1 rounded-lg bg-[#0d8b58] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#0b7a4d]"
              type="button"
              onClick={() => void onExport()}
            >
              <span aria-hidden>↧</span>
              Export CSV
            </button>
          ) : null}
        </div>
      </form>

      {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}

      {loading ? <LoadingState label="Searching ledger..." /> : null}
      {result && !loading ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {result.items.length === 0 ? (
            <div className="rounded-xl border border-parsel-border bg-white py-20">
              <EmptyState title="No transactions found" detail="Try adjusting your filters." />
              <div className="mt-4 flex justify-center gap-3">
                <button className="rounded-lg border border-parsel-border px-4 py-2 text-sm" type="button" onClick={clearFilters}>
                  Clear all filters
                </button>
                <Link
                  to="/ledger/add"
                  className="rounded-lg bg-[#0d8b58] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Add New Entry
                </Link>
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

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d9e0ea] bg-[#f8fafd] px-4 py-2.5">
            <p className="text-sm text-[#667085]">
              Showing {rangeStart}-{rangeEnd} of {result.total} transactions
            </p>
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg border border-[#d6deea] bg-white px-3 py-1.5 text-sm text-[#5f6775] disabled:opacity-40"
                type="button"
                disabled={result.page <= 1}
                onClick={() => void runSearch(result.page - 1)}
              >
                Prev
              </button>
              {pages.map((n, i) => {
                const prev = pages[i - 1];
                const showEllipsis = prev !== undefined && n - prev > 1;
                return (
                  <span key={n} className="flex items-center gap-1">
                    {showEllipsis ? <span className="px-1 text-parsel-muted">…</span> : null}
                    <button
                      className={`min-w-[2rem] rounded-lg border px-2 py-1.5 text-sm ${
                        n === result.page
                          ? "border-[#86acf0] bg-[#e9f1ff] font-semibold text-[#2f62be]"
                          : "border-[#d6deea] bg-white text-[#5f6775]"
                      }`}
                      type="button"
                      disabled={n === result.page}
                      onClick={() => void runSearch(n)}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
              <button
                className="rounded-lg border border-[#d6deea] bg-white px-3 py-1.5 text-sm text-[#5f6775] disabled:opacity-40"
                type="button"
                disabled={result.page >= totalPages}
                onClick={() => void runSearch(result.page + 1)}
              >
                Next
              </button>
            </div>
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
