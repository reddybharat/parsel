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
        className={`h-auto px-0 py-0 font-semibold hover:bg-transparent ${isActive ? "text-parsel-nav-active-text" : "text-parsel-muted hover:text-parsel-nav-active-text"}`}
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
    <div className="min-h-0 overflow-auto rounded-none border border-parsel-border bg-parsel-surface shadow-none">
      <Table>
        <TableHeader>
          <TableRow className="sticky top-0 z-10 border-parsel-border bg-parsel-soft hover:bg-parsel-soft">
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
              <SortableHeader label="Date" column="transaction_date" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
              <SortableHeader label="Amount" column="amount" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
              <SortableHeader label="Category" column="category" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
              <SortableHeader label="Payment" column="payment_method" />
            </TableHead>
            <TableHead className="px-4 py-2.5 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
              <SortableHeader label="Description" column="description" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id} className="border-parsel-border hover:bg-parsel-soft">
              <TableCell className="whitespace-nowrap px-4 py-2.5 text-[13px] text-parsel-text">
                {formatDisplayDate(row.transaction_date)}
              </TableCell>
              <TableCell
                className={`whitespace-nowrap px-4 py-2.5 tabular-nums text-[13px] ${row.is_debit ? "text-parsel-outflow" : "text-parsel-inflow"}`}
              >
                {formatInrSigned(signedAmount(row.amount, row.is_debit))}
              </TableCell>
              <TableCell className="px-4 py-2.5">
                <Badge
                  className={row.is_debit ? "bg-parsel-soft text-parsel-muted hover:bg-parsel-soft" : "bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg"}
                  variant="secondary"
                >
                  {row.category}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 py-2.5 text-parsel-muted">{row.payment_method || "-"}</TableCell>
              <TableCell className="px-4 py-2.5 text-parsel-text">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.description || "-"}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      className="text-parsel-muted hover:bg-parsel-nav-active-bg hover:text-parsel-muted"
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit transaction"
                      onClick={() => onEdit(row)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      className="text-parsel-danger hover:bg-parsel-danger-bg hover:text-parsel-danger"
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
