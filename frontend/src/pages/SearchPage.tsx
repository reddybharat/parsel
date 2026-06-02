import { FormEvent, useEffect, useMemo, useState } from "react";

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

  async function onDelete(id: string) {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      await deleteTransaction(id);
      setStatusMessage("Transaction deleted.");
      await runSearch(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  async function onEditSave(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await updateTransaction(editing.id, editing);
      setEditing(null);
      setStatusMessage("Transaction updated.");
      await runSearch(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
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
      <h2 className="text-lg font-semibold">Ledger Search</h2>

      <form className="grid gap-3 md:grid-cols-4" onSubmit={onSearchSubmit}>
        <input className="rounded border p-2" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="rounded border p-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <select className="rounded border p-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option>All</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded border p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          <option>All</option>
          {paymentMethods.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="rounded border p-2" value={creditDebit} onChange={(e) => setCreditDebit(e.target.value)}>
          <option>All</option>
          <option>Credit</option>
          <option>Debit</option>
        </select>
        <select
          className="rounded border p-2"
          value={sortColumn}
          onChange={(e) => setSortColumn(e.target.value as "transaction_date" | "amount")}
        >
          <option value="transaction_date">Date</option>
          <option value="amount">Amount</option>
        </select>
        <select
          className="rounded border p-2"
          value={sortDesc ? "desc" : "asc"}
          onChange={(e) => setSortDesc(e.target.value === "desc")}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <input
          className="rounded border p-2"
          type="number"
          min={10}
          max={50}
          step={5}
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        />
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-3 py-2 text-white" type="submit" disabled={loading}>
            Search
          </button>
          <button className="rounded border px-3 py-2" type="button" onClick={() => void onExport()}>
            Export CSV
          </button>
        </div>
      </form>

      {statusMessage && <p className="text-sm text-green-700">{statusMessage}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {editing && (
        <form className="grid gap-2 rounded border border-blue-200 bg-blue-50 p-3 md:grid-cols-3" onSubmit={onEditSave}>
          <h3 className="md:col-span-3 font-medium">Edit Transaction</h3>
          <input
            className="rounded border p-2"
            type="number"
            min={0.01}
            step={0.01}
            value={editing.amount}
            onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
          />
          <select
            className="rounded border p-2"
            value={editing.is_debit ? "Debit" : "Credit"}
            onChange={(e) => setEditing({ ...editing, is_debit: e.target.value === "Debit" })}
          >
            <option>Debit</option>
            <option>Credit</option>
          </select>
          <input
            className="rounded border p-2"
            type="date"
            value={editing.transaction_date}
            onChange={(e) => setEditing({ ...editing, transaction_date: e.target.value })}
          />
          <select
            className="rounded border p-2"
            value={editing.category}
            onChange={(e) => setEditing({ ...editing, category: e.target.value })}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            className="rounded border p-2"
            value={editing.payment_method || ""}
            onChange={(e) => setEditing({ ...editing, payment_method: e.target.value || null })}
          >
            <option value="">Select payment method</option>
            {paymentMethods.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            className="rounded border p-2 md:col-span-3"
            type="text"
            value={editing.description || ""}
            onChange={(e) => setEditing({ ...editing, description: e.target.value || null })}
            placeholder="Description"
          />
          <div className="md:col-span-3 flex gap-2">
            <button className="rounded bg-blue-600 px-3 py-2 text-white" type="submit">
              Save
            </button>
            <button className="rounded border px-3 py-2" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {result && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500">
            Showing {result.items.length} of {result.total}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">Date</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Payment</th>
                  <th className="p-2">Description</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="p-2">{row.transaction_date}</td>
                    <td className="p-2">{formatInrSigned(signedAmount(row.amount, row.is_debit))}</td>
                    <td className="p-2">{row.category}</td>
                    <td className="p-2">{row.payment_method || "-"}</td>
                    <td className="p-2">{row.description || "-"}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button className="rounded border px-2 py-1" onClick={() => setEditing(row)} type="button">
                          Edit
                        </button>
                        <button className="rounded border px-2 py-1" onClick={() => void onDelete(row.id)} type="button">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button className="rounded border px-3 py-2" disabled={!hasPrevious} onClick={() => void runSearch(page - 1)}>
              Prev
            </button>
            <button className="rounded border px-3 py-2" disabled={!hasNext} onClick={() => void runSearch(page + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
