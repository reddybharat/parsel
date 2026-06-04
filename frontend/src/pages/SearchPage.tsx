import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { LoadingState } from "../components/feedback/LoadingState";
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

const PRESET_ACTIVE = "rounded-full bg-[#e5edf9] px-3 py-1 text-xs font-semibold text-parsel-primary";
const PRESET_IDLE = "rounded-full bg-[#f0f2f6] px-3 py-1 text-xs font-semibold text-parsel-secondary";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-parsel-secondary">{children}</p>;
}

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
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [creditDebit, setCreditDebit] = useState("All");
  const [activePreset, setActivePreset] = useState<DatePreset | null>(null);
  const [sortColumn, setSortColumn] = useState<"transaction_date" | "amount">("transaction_date");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

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
    setPaymentMethod("All");
    setCreditDebit("All");
    setActivePreset(null);
  }

  async function runSearch(
    targetPage = page,
    opts?: { sortColumn?: typeof sortColumn; sortDesc?: boolean; pageSize?: number },
  ) {
    const nextSortColumn = opts?.sortColumn ?? sortColumn;
    const nextSortDesc = opts?.sortDesc ?? sortDesc;
    const nextPageSize = opts?.pageSize ?? pageSize;
    setLoading(true);
    setError(null);
    try {
      const data = await searchTransactions({
        start_date: startDate,
        end_date: endDate,
        category,
        payment_method: paymentMethod,
        is_debit: creditDebit === "All" ? undefined : creditDebit === "Debit",
        sort_column: nextSortColumn,
        sort_desc: nextSortDesc,
        page: targetPage,
        page_size: nextPageSize,
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
        payment_method: paymentMethod,
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

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-[#f3c4c4] bg-[#fdecec] px-4 py-2 text-sm text-[#c44747]">
          <span>Failed to fetch data. Please try again.</span>
          <button className="rounded bg-white px-3 py-1 text-xs font-semibold" onClick={() => void runSearch(page)}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[40px] font-semibold tracking-tight text-parsel-neutral">Ledger</h2>
          <p className="text-sm text-parsel-muted">Your detailed financial footprint, organized and verified.</p>
        </div>
        <Link
          to="/ledger/add"
          className="rounded-lg bg-parsel-primary px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Add Transaction
        </Link>
      </div>

      <form className="space-y-3 rounded-xl border border-parsel-border bg-white p-3" onSubmit={onSearchSubmit}>
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
        <div className="grid gap-3 md:grid-cols-6">
          <div>
            <FieldLabel>Start Date</FieldLabel>
            <input
              className="w-full rounded-lg border border-parsel-border p-2 text-sm"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <input
              className="w-full rounded-lg border border-parsel-border p-2 text-sm"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <select className="w-full rounded-lg border border-parsel-border p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="All">All Categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Payment method</FieldLabel>
            <select
              className="w-full rounded-lg border border-parsel-border p-2"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="All">All Methods</option>
              {paymentMethods.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <select className="w-full rounded-lg border border-parsel-border p-2" value={creditDebit} onChange={(e) => setCreditDebit(e.target.value)}>
              <option value="All">All Types</option>
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-lg bg-parsel-primary px-3 py-2 text-sm font-semibold text-white" type="submit" disabled={loading}>
              Search
            </button>
          </div>
        </div>
      </form>

      {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}

      {loading ? <LoadingState label="Searching ledger..." /> : null}
      {result && !loading ? (
        <div className="space-y-3">
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
            <TransactionTable items={result.items} onEdit={(row) => setEditing(row)} onDelete={(row) => setDeleting(row)} />
          )}

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-parsel-border bg-white p-3">
            <div>
              <FieldLabel>Sort by</FieldLabel>
              <select
                className="rounded-lg border border-parsel-border p-2 text-sm"
                value={sortColumn}
                onChange={(e) => {
                  const col = e.target.value as "transaction_date" | "amount";
                  setSortColumn(col);
                  void runSearch(1, { sortColumn: col });
                }}
              >
                <option value="transaction_date">Date</option>
                <option value="amount">Amount</option>
              </select>
            </div>
            <div>
              <FieldLabel>Order</FieldLabel>
              <select
                className="rounded-lg border border-parsel-border p-2 text-sm"
                value={sortDesc ? "desc" : "asc"}
                onChange={(e) => {
                  const desc = e.target.value === "desc";
                  setSortDesc(desc);
                  void runSearch(1, { sortDesc: desc });
                }}
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
            <div>
              <FieldLabel>Page size</FieldLabel>
              <input
                className="w-20 rounded-lg border border-parsel-border p-2 text-sm"
                type="number"
                min={10}
                max={50}
                step={5}
                value={pageSize}
                onChange={(e) => {
                  const size = Number(e.target.value);
                  setPageSize(size);
                  void runSearch(1, { pageSize: size });
                }}
              />
            </div>
            <button
              className="ml-auto inline-flex items-center gap-1 rounded-lg border border-parsel-border px-3 py-2 text-sm"
              type="button"
              onClick={() => void onExport()}
            >
              <span aria-hidden>↧</span>
              Export CSV
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-parsel-muted">
              Showing {rangeStart}-{rangeEnd} of {result.total} transactions
            </p>
            <div className="flex items-center gap-1">
              <button
                className="rounded-lg border border-parsel-border px-3 py-2 text-sm disabled:opacity-40"
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
                      className={`min-w-[2.25rem] rounded-lg border px-2 py-2 text-sm ${
                        n === result.page ? "border-parsel-primary font-semibold text-parsel-primary" : "border-parsel-border"
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
                className="rounded-lg border border-parsel-border px-3 py-2 text-sm disabled:opacity-40"
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
