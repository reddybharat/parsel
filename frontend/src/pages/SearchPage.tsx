import { FormEvent, useEffect, useMemo, useState } from "react";

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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
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

  const [startDate, setStartDate] = useState(monthStartIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("All");
  const [creditDebit, setCreditDebit] = useState("All");
  const [sortColumn, setSortColumn] = useState<"transaction_date" | "amount">("transaction_date");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const hasPrevious = (result?.page ?? 1) > 1;
  const hasNext = useMemo(() => {
    if (!result) return false;
    return result.page * result.page_size < result.total;
  }, [result]);

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

  async function runSearch(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const data = await searchTransactions({
        start_date: startDate,
        end_date: endDate,
        category,
        payment_method: paymentMethod,
        is_debit: creditDebit === "All" ? undefined : creditDebit === "Debit",
        sort_column: sortColumn,
        sort_desc: sortDesc,
        page: targetPage,
        page_size: pageSize,
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
        <button className="rounded-lg bg-parsel-primary px-5 py-2 text-sm font-semibold text-white">+ Add Transaction</button>
      </div>

      <form className="grid gap-3 rounded-xl border border-parsel-border bg-white p-3 md:grid-cols-4" onSubmit={onSearchSubmit}>
        <div className="col-span-full flex flex-wrap gap-2">
          <button className="rounded-full bg-[#e5edf9] px-3 py-1 text-xs font-semibold text-parsel-primary" type="button">Today</button>
          <button className="rounded-full bg-[#f0f2f6] px-3 py-1 text-xs font-semibold text-parsel-secondary" type="button">Last 7 days</button>
          <button className="rounded-full bg-[#f0f2f6] px-3 py-1 text-xs font-semibold text-parsel-secondary" type="button">This month</button>
          <button className="rounded-full bg-[#f0f2f6] px-3 py-1 text-xs font-semibold text-parsel-secondary" type="button">All Filters</button>
          <div className="ml-auto hidden rounded-lg border border-parsel-border px-3 py-1 text-xs text-parsel-muted md:block">
            Search descriptions...
          </div>
        </div>
        <input className="rounded-lg border border-parsel-border p-2 text-sm" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="rounded-lg border border-parsel-border p-2 text-sm" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="rounded-lg border border-parsel-border p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>All</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded-lg border border-parsel-border p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option>All</option>
          {paymentMethods.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded-lg border border-parsel-border p-2" value={creditDebit} onChange={(e) => setCreditDebit(e.target.value)}>
          <option>All</option>
          <option>Credit</option>
          <option>Debit</option>
        </select>
        <select
          className="rounded-lg border border-parsel-border p-2"
          value={sortColumn}
          onChange={(e) => setSortColumn(e.target.value as "transaction_date" | "amount")}
        >
          <option value="transaction_date">Date</option>
          <option value="amount">Amount</option>
        </select>
        <select
          className="rounded-lg border border-parsel-border p-2"
          value={sortDesc ? "desc" : "asc"}
          onChange={(e) => setSortDesc(e.target.value === "desc")}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <input className="rounded-lg border border-parsel-border p-2" type="number" min={10} max={50} step={5} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} />
        <div className="flex gap-2">
          <button className="rounded-lg bg-parsel-primary px-3 py-2 text-white" type="submit" disabled={loading}>
            Search
          </button>
          <button className="rounded-lg border border-parsel-border px-3 py-2" type="button" onClick={() => void onExport()}>
            Export CSV
          </button>
        </div>
      </form>

      {statusMessage && <p className="text-sm text-emerald-700">{statusMessage}</p>}

      {loading ? <LoadingState label="Searching ledger..." /> : null}
      {result && !loading ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Showing {result.items.length} of {result.total} transactions</p>
          {result.items.length === 0 ? (
            <>
              <div className="rounded-xl border border-parsel-border bg-white py-20">
                <EmptyState title="No transactions found" detail="Try adjusting your filters or search terms." />
                <div className="mt-4 flex justify-center gap-3">
                  <button className="rounded-lg border border-parsel-border px-4 py-2 text-sm">Clear all filters</button>
                  <button className="rounded-lg bg-[#0d8b58] px-4 py-2 text-sm font-semibold text-white">Add New Entry</button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-parsel-border bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-parsel-secondary">Period Net Flow</p>
                  <p className="mt-1 font-mono text-3xl font-semibold">₹0.00</p>
                </div>
                <div className="rounded-xl border border-parsel-border bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-parsel-secondary">Total Income</p>
                  <p className="mt-1 font-mono text-3xl font-semibold text-[#0c8756]">₹0.00</p>
                </div>
                <div className="rounded-xl border border-parsel-border bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-parsel-secondary">Total Expenses</p>
                  <p className="mt-1 font-mono text-3xl font-semibold text-[#c64040]">₹0.00</p>
                </div>
              </div>
            </>
          ) : (
            <TransactionTable items={result.items} onEdit={(row) => setEditing(row)} onDelete={(row) => setDeleting(row)} />
          )}
          <div className="flex gap-2">
            <button className="rounded-lg border border-parsel-border px-3 py-2" disabled={!hasPrevious} onClick={() => void runSearch(page - 1)}>
              Prev
            </button>
            <button className="rounded-lg border border-parsel-border px-3 py-2" disabled={!hasNext} onClick={() => void runSearch(page + 1)}>
              Next
            </button>
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
