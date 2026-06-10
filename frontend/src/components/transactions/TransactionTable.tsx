import { formatInrSigned, signedAmount } from "../../lib/format";
import type { Transaction } from "../../lib/types";

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

export function TransactionTable({
  items,
  onEdit,
  onDelete,
  sortColumn,
  sortDesc,
  onSortChange,
}: {
  items: Transaction[];
  onEdit: (row: Transaction) => void;
  onDelete: (row: Transaction) => void;
  sortColumn: "transaction_date" | "amount" | "category" | "payment_method" | "description";
  sortDesc: boolean;
  onSortChange: (column: "transaction_date" | "amount" | "category" | "payment_method" | "description") => void;
}) {
  function SortableHeader({
    label,
    column,
  }: {
    label: string;
    column: "transaction_date" | "amount" | "category" | "payment_method" | "description";
  }) {
    const isActive = sortColumn === column;
    const arrow = isActive ? (sortDesc ? "↓" : "↑") : "↕";
    return (
      <button
        type="button"
        className={`inline-flex items-center gap-1 font-semibold ${
          isActive ? "text-[#2f62be]" : "text-[#596376] hover:text-[#2f62be]"
        }`}
        onClick={() => onSortChange(column)}
      >
        {label}
        <span aria-hidden className="text-[11px] leading-none">
          {arrow}
        </span>
      </button>
    );
  }

  return (
    <div className="min-h-0 overflow-auto rounded-2xl border border-[#d9e0ea] bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-[#e2e7f0] bg-[#f8fafd] text-left text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
            <th className="px-4 py-2.5 font-semibold">
              <SortableHeader label="Date" column="transaction_date" />
            </th>
            <th className="px-4 py-2.5 font-semibold">
              <SortableHeader label="Amount" column="amount" />
            </th>
            <th className="px-4 py-2.5 font-semibold">
              <SortableHeader label="Category" column="category" />
            </th>
            <th className="px-4 py-2.5 font-semibold">
              <SortableHeader label="Payment" column="payment_method" />
            </th>
            <th className="px-4 py-2.5 font-semibold">
              <SortableHeader label="Description" column="description" />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-[#edf1f7] hover:bg-[#fbfcff]">
              <td className="whitespace-nowrap px-4 py-2.5 text-[13px] text-[#2e3849]">{formatDisplayDate(row.transaction_date)}</td>
              <td className={`whitespace-nowrap px-4 py-2.5 font-mono text-[13px] ${row.is_debit ? "text-[#d03a35]" : "text-[#2a6fce]"}`}>
                {formatInrSigned(signedAmount(row.amount, row.is_debit))}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    row.is_debit ? "bg-[#f0f2f5] text-[#626c7c]" : "bg-[#e7efff] text-[#2f62be]"
                  }`}
                >
                  {row.category}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-[#4f5a6e]">{row.payment_method || "-"}</td>
              <td className="px-4 py-2.5 text-[#2e3849]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.description || "-"}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded-md px-2 py-1 text-[#5f6a7d] hover:bg-[#eef3fb]"
                      type="button"
                      aria-label="Edit transaction"
                      onClick={() => onEdit(row)}
                    >
                      ✎
                    </button>
                    <button
                      className="rounded-md px-2 py-1 text-[#b43d4e] hover:bg-[#fdf0f3]"
                      type="button"
                      aria-label="Delete transaction"
                      onClick={() => onDelete(row)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
