import { formatInrSigned, signedAmount } from "../../lib/format";
import type { Transaction } from "../../lib/types";

export function TransactionTable({
  items,
  onEdit,
  onDelete,
}: {
  items: Transaction[];
  onEdit: (row: Transaction) => void;
  onDelete: (row: Transaction) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-parsel-border bg-white">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-parsel-border text-left text-xs uppercase tracking-wide text-parsel-secondary">
            <th className="p-4 font-semibold">Date</th>
            <th className="p-4 font-semibold">Amount</th>
            <th className="p-4 font-semibold">Category</th>
            <th className="p-4 font-semibold">Payment</th>
            <th className="p-4 font-semibold">Description</th>
            <th className="p-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-t border-parsel-border">
              <td className="p-4">{row.transaction_date}</td>
              <td className={`p-4 font-mono ${row.is_debit ? "text-[#cc3d3d]" : "text-[#2a6fce]"}`}>
                {formatInrSigned(signedAmount(row.amount, row.is_debit))}
              </td>
              <td className="p-4">
                <span className="rounded-full bg-[#ebedf2] px-2 py-1 text-xs font-medium text-parsel-secondary">{row.category}</span>
              </td>
              <td className="p-4">{row.payment_method || "-"}</td>
              <td className="p-4">{row.description || "-"}</td>
              <td className="p-4">
                <div className="flex gap-2">
                  <button className="rounded-md px-2 py-1 text-parsel-secondary hover:bg-parsel-soft" type="button" onClick={() => onEdit(row)}>
                    ✎
                  </button>
                  <button className="rounded-md px-2 py-1 text-[#b43d4e] hover:bg-[#fdf0f3]" type="button" onClick={() => onDelete(row)}>
                    🗑
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
