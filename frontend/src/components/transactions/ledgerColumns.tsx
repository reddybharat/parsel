import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatInrSigned, signedAmount } from "@/lib/format";
import type { Transaction } from "@/lib/types";

/** Zero-padded day + short month so the date column aligns in tabular nums. */
function formatLedgerDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthLabel = date.toLocaleDateString("en-IN", { month: "short" });
  return `${String(day).padStart(2, "0")} ${monthLabel} ${year}`;
}

export function createLedgerColumns({
  onEdit,
  onDelete,
}: {
  onEdit: (row: Transaction) => void;
  onDelete: (row: Transaction) => void;
}): ColumnDef<Transaction>[] {
  return [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: { width: "2.25rem", skeletonWidth: "1rem" },
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          aria-label="Select all rows on this page"
          className="translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label="Select row"
          className="translate-y-[1px]"
        />
      ),
    },
    {
      accessorKey: "transaction_date",
      sortDescFirst: true,
      meta: { label: "Date", width: "7.5rem", skeletonWidth: "5.5rem" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums text-parsel-text">
          {formatLedgerDate(row.original.transaction_date)}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      meta: { label: "Amount", align: "right", width: "9rem", skeletonWidth: "70%" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => {
        const { amount, is_debit } = row.original;
        return (
          <span
            className={`whitespace-nowrap font-medium tabular-nums ${
              is_debit ? "text-parsel-outflow" : "text-parsel-inflow"
            }`}
          >
            {formatInrSigned(signedAmount(amount, is_debit))}
          </span>
        );
      },
    },
    {
      accessorKey: "category",
      meta: { label: "Category", width: "9rem", skeletonWidth: "70%" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.category}>
          {row.original.category}
        </span>
      ),
    },
    {
      accessorKey: "description",
      meta: { label: "Description", skeletonWidth: "80%" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
      cell: ({ row }) => {
        const description = row.original.description;
        if (!description) {
          return <span className="text-parsel-muted">—</span>;
        }
        return (
          <span className="block truncate" title={description}>
            {description}
          </span>
        );
      },
    },
    {
      accessorKey: "payment_method",
      meta: { label: "Method", width: "7rem", skeletonWidth: "60%" },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
      cell: ({ row }) => (
        <span className="block truncate text-parsel-muted" title={row.original.payment_method ?? undefined}>
          {row.original.payment_method || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      meta: { width: "2.5rem", skeletonWidth: "1rem" },
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-parsel-muted opacity-0 transition-opacity hover:text-parsel-text focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Actions for ${row.original.category} on ${row.original.transaction_date}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onEdit(row.original)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(row.original)}
              className="text-parsel-danger focus:bg-parsel-danger-bg focus:text-parsel-danger"
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];
}
