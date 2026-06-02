import type { Transaction } from "../../lib/types";

export function EditTransactionDialog({
  open,
  transaction,
  categories,
  paymentMethods,
  loading,
  onChange,
  onSave,
  onCancel,
}: {
  open: boolean;
  transaction: Transaction | null;
  categories: string[];
  paymentMethods: string[];
  loading: boolean;
  onChange: (next: Transaction) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!open || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#667085]/60 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-xl rounded-xl border border-parsel-border bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-parsel-border px-4 py-3">
          <h3 className="text-2xl font-semibold tracking-tight text-parsel-neutral">Edit Transaction</h3>
          <button className="text-parsel-muted" onClick={onCancel} type="button">
            ✕
          </button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Amount</p>
          <input
            className="rounded-lg border border-parsel-border p-2 font-mono text-[#d3375f] md:col-span-2"
            type="number"
            min={0.01}
            step={0.01}
            value={transaction.amount}
            onChange={(e) => onChange({ ...transaction, amount: Number(e.target.value) })}
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Category</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Date</p>
          <select
            className="rounded-lg border border-parsel-border p-2"
            value={transaction.category}
            onChange={(e) => onChange({ ...transaction, category: e.target.value })}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <input
            className="rounded-lg border border-parsel-border p-2"
            type="date"
            value={transaction.transaction_date}
            onChange={(e) => onChange({ ...transaction, transaction_date: e.target.value })}
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Payment Method</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Type</p>
          <select
            className="rounded-lg border border-parsel-border p-2"
            value={transaction.payment_method || ""}
            onChange={(e) => onChange({ ...transaction, payment_method: e.target.value || null })}
          >
            <option value="">Select payment method</option>
            {paymentMethods.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-parsel-border p-2"
            value={transaction.is_debit ? "Debit" : "Credit"}
            onChange={(e) => onChange({ ...transaction, is_debit: e.target.value === "Debit" })}
          >
            <option>Debit</option>
            <option>Credit</option>
          </select>
          <p className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Description</p>
          <textarea
            className="rounded-lg border border-parsel-border p-2 md:col-span-2"
            rows={3}
            value={transaction.description || ""}
            onChange={(e) => onChange({ ...transaction, description: e.target.value || null })}
            placeholder="Description"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-parsel-border px-4 py-3">
          <button className="rounded-lg px-3 py-2 text-sm font-semibold text-parsel-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="rounded-lg bg-[#dfe8fe] px-4 py-2 text-sm font-semibold text-[#5a71ae] disabled:opacity-50"
            onClick={onSave}
            type="button"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
