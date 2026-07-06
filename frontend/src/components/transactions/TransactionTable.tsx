import { Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      <Button
        className={`h-auto px-0 py-0 font-semibold hover:bg-transparent ${isActive ? "text-[#2f62be]" : "text-[#596376] hover:text-[#2f62be]"}`}
        type="button"
        variant="ghost"
        onClick={() => onSortChange(column)}
      >
        {label}
        <span aria-hidden className="text-[11px] leading-none">
          {arrow}
        </span>
      </Button>
    );
  }

  return (
    <div className="min-h-0 overflow-auto rounded-2xl border border-[#d9e0ea] bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 border-[#e2e7f0] bg-[#f8fafd] hover:bg-[#f8fafd]">
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
              <SortableHeader label="Date" column="transaction_date" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
              <SortableHeader label="Amount" column="amount" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
              <SortableHeader label="Category" column="category" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
              <SortableHeader label="Payment" column="payment_method" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-[#5e6878]">
              <SortableHeader label="Description" column="description" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} className="border-[#edf1f7] hover:bg-[#fbfcff]">
              <TableCell className="whitespace-nowrap px-4 py-2.5 text-[13px] text-[#2e3849]">
                {formatDisplayDate(row.transaction_date)}
              </TableCell>
              <TableCell
                className={`whitespace-nowrap px-4 py-2.5 tabular-nums text-[13px] ${row.is_debit ? "text-[#d03a35]" : "text-[#2a6fce]"}`}
              >
                {formatInrSigned(signedAmount(row.amount, row.is_debit))}
              </TableCell>
              <TableCell className="px-4 py-2.5">
                <Badge
                  className={row.is_debit ? "bg-[#f0f2f5] text-[#626c7c] hover:bg-[#f0f2f5]" : "bg-[#e7efff] text-[#2f62be] hover:bg-[#e7efff]"}
                  variant="secondary"
                >
                  {row.category}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-2.5 text-[#4f5a6e]">{row.payment_method || "-"}</TableCell>
              <TableCell className="px-4 py-2.5 text-[#2e3849]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.description || "-"}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      className="text-[#5f6a7d] hover:bg-[#eef3fb] hover:text-[#5f6a7d]"
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit transaction"
                      onClick={() => onEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      className="text-[#b43d4e] hover:bg-[#fdf0f3] hover:text-[#b43d4e]"
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete transaction"
                      onClick={() => onDelete(row)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
