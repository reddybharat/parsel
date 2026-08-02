import { useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Check, Plus, X } from "lucide-react";

import type { ImportFieldIssue } from "@/api/tracker";
import { CategorySelect } from "@/components/transactions/CategorySelect";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { isCategoryKnown, isRowSelectable, type EditableImportRow } from "@/lib/importReview";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

const DESCRIPTION_MIN_PX = 28; // matches h-7

function ImportDescriptionField({
  value,
  expanded,
  disabled,
  onChange,
}: {
  value: string;
  expanded: boolean;
  disabled: boolean;
  onChange: (next: string | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (!expanded) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, DESCRIPTION_MIN_PX)}px`;
  }, [expanded, value]);

  if (!expanded) {
    return (
      <Input
        value={value}
        title={value || undefined}
        disabled={disabled}
        placeholder="—"
        onChange={(e) => onChange(e.target.value || null)}
        className="h-7 min-w-0 truncate rounded-none border-input px-2 text-xs shadow-none"
      />
    );
  }

  return (
    <Textarea
      ref={ref}
      value={value}
      title={value || undefined}
      disabled={disabled}
      placeholder="—"
      rows={1}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value || null)}
      className="min-h-7 resize-none overflow-hidden rounded-none border-input px-2 py-1.5 text-xs leading-snug shadow-none"
    />
  );
}

function fieldIssue(row: EditableImportRow, field: string): ImportFieldIssue | undefined {
  if (row.imported) return undefined;
  return row.issues.find((issue) => issue.field === field);
}

function FieldShell({
  issue,
  children,
  className,
}: {
  issue?: ImportFieldIssue;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {children}
      {issue ? (
        <p
          className="flex items-center gap-1 text-[10px] leading-none text-parsel-outflow"
          title={issue.message}
        >
          <AlertCircle className="size-2.5 shrink-0" aria-hidden />
          <span className="truncate">{issue.message}</span>
        </p>
      ) : null}
    </div>
  );
}

function fieldInputClass(issue?: ImportFieldIssue) {
  return cn(
    "h-7 rounded-none border-input px-2 text-xs shadow-none",
    issue && "border-parsel-outflow ring-1 ring-parsel-outflow/30",
  );
}

/** Static cell text sits on the same baseline as the h-7 inline editors beside it. */
const staticCellClass = "flex h-7 items-center";

const FIELD_LABELS: Record<string, string> = {
  transaction_date: "Date",
  is_debit: "Type",
  category: "Category",
  amount: "Amount",
  payment_method: "Method",
  bank: "Bank",
  description: "Description",
  row: "Row",
};

/** Hover/focus summary of everything blocking a row, so "Fix" says what to fix. */
function RowIssuesHint({ issues }: { issues: ImportFieldIssue[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          staticCellClass,
          "gap-1 text-[10px] font-semibold uppercase tracking-wide text-parsel-outflow underline decoration-dotted underline-offset-2",
        )}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <AlertCircle className="size-3 shrink-0" aria-hidden />
        Fix
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="left"
        className="pointer-events-none w-60 border-parsel-border bg-parsel-surface p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-parsel-muted">
          {issues.length} issue{issues.length === 1 ? "" : "s"} on this row
        </p>
        <ul className="mt-2 space-y-1.5">
          {issues.map((issue, index) => (
            <li key={`${issue.field}-${index}`} className="text-xs leading-snug text-parsel-text">
              <span className="font-semibold">{FIELD_LABELS[issue.field] ?? issue.field}</span>
              {" — "}
              {issue.message}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function createImportReviewColumns({
  categories,
  paymentMethods,
  onRowChange,
  onApproveNewCategory,
  onRemoveRow,
}: {
  categories: Category[];
  paymentMethods: string[];
  onRowChange: (sourceRow: number, patch: Partial<EditableImportRow>) => void;
  onApproveNewCategory: (sourceRow: number) => void;
  onRemoveRow?: (sourceRow: number) => void;
}): ColumnDef<EditableImportRow>[] {
  return [
    {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      meta: { width: "2.25rem", skeletonWidth: "1rem" },
      header: ({ table }) => {
        const eligible = table.getRowModel().rows.filter((row) => isRowSelectable(row.original));
        const selectedEligible = eligible.filter((row) => row.getIsSelected());
        const allSelected = eligible.length > 0 && selectedEligible.length === eligible.length;
        const someSelected = selectedEligible.length > 0 && !allSelected;

        return (
          <Checkbox
            checked={allSelected || (someSelected && "indeterminate")}
            disabled={eligible.length === 0}
            onCheckedChange={(value: boolean | "indeterminate") => {
              for (const row of eligible) {
                row.toggleSelected(value === true);
              }
            }}
            aria-label="Select all ready rows"
            className="translate-y-[1px]"
          />
        );
      },
      cell: ({ row }) => (
        <span className={staticCellClass}>
          <Checkbox
            checked={row.getIsSelected()}
            disabled={!isRowSelectable(row.original)}
            onCheckedChange={(value: boolean | "indeterminate") =>
              row.toggleSelected(value === true)
            }
            aria-label={`Select row ${row.original.source_row}`}
          />
        </span>
      ),
    },
    {
      accessorKey: "source_row",
      meta: { label: "Row", width: "3rem", skeletonWidth: "2rem" },
      header: () => <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Row</span>,
      cell: ({ row }) => (
        <span className={cn(staticCellClass, "tabular-nums text-parsel-muted")}>
          {row.original.source_row}
        </span>
      ),
    },
    {
      accessorKey: "transaction_date",
      meta: { label: "Date", width: "8.5rem", skeletonWidth: "5rem" },
      header: () => <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Date</span>,
      cell: ({ row }) => {
        const issue = fieldIssue(row.original, "transaction_date");
        return (
          <FieldShell issue={issue}>
            <DatePicker
              value={row.original.transaction_date}
              onChange={(value) =>
                onRowChange(row.original.source_row, { transaction_date: value })
              }
              disabled={row.original.imported}
              placeholder="Date"
              className={cn(
                "h-7 rounded-none px-2 text-xs shadow-none",
                "[&_svg]:size-3.5",
                issue && "border-parsel-outflow ring-1 ring-parsel-outflow/30",
              )}
            />
          </FieldShell>
        );
      },
    },
    {
      accessorKey: "is_debit",
      meta: { label: "Type", width: "7rem", skeletonWidth: "4rem" },
      header: () => <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Type</span>,
      cell: ({ row }) => {
        const issue = fieldIssue(row.original, "is_debit");
        const raw = row.original.is_debit.trim().toLowerCase();
        const typeValue = !raw
          ? ""
          : ["false", "f", "0", "no", "n"].includes(raw)
            ? "credit"
            : "debit";
        return (
          <FieldShell issue={issue}>
            <NativeSelect
              size="xs"
              value={typeValue}
              onChange={(e) =>
                onRowChange(row.original.source_row, {
                  is_debit:
                    e.target.value === "debit"
                      ? "true"
                      : e.target.value === "credit"
                        ? "false"
                        : "",
                })
              }
              disabled={row.original.imported}
              aria-invalid={Boolean(issue)}
            >
              <NativeSelectOption value="">Type</NativeSelectOption>
              <NativeSelectOption value="debit">Debit</NativeSelectOption>
              <NativeSelectOption value="credit">Credit</NativeSelectOption>
            </NativeSelect>
          </FieldShell>
        );
      },
    },
    {
      accessorKey: "category",
      meta: { label: "Category", width: "11rem", skeletonWidth: "70%" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Category</span>
      ),
      cell: ({ row }) => {
        const issue = fieldIssue(row.original, "category");
        const unknown = issue?.code === "unknown_category";
        const name = row.original.category.trim();

        if (row.original.imported) {
          return (
            <span className={cn(staticCellClass, "text-parsel-muted")}>
              <span className="truncate">{row.original.category}</span>
            </span>
          );
        }

        return (
          // An unmapped category is a choice, not a mistake, so it reads as an action instead of an error.
          <FieldShell issue={unknown ? undefined : issue}>
            <CategorySelect
              value={row.original.category}
              categories={categories}
              onChange={(next) =>
                onRowChange(row.original.source_row, {
                  category: next,
                  approved_new_category: !isCategoryKnown(next, categories),
                })
              }
              allowEmpty
              placeholder="Category"
              size="xs"
              invalid={Boolean(issue) && !unknown}
            />
            {unknown ? (
              <button
                type="button"
                className="flex w-full items-center gap-1 text-[10px] leading-none text-parsel-primary hover:underline"
                title={issue?.message}
                onClick={() => onApproveNewCategory(row.original.source_row)}
              >
                <Plus className="size-2.5 shrink-0" aria-hidden />
                <span className="truncate">Create &quot;{name}&quot;</span>
              </button>
            ) : row.original.approved_new_category && !isCategoryKnown(name, categories) ? (
              <p className="text-[10px] leading-none text-parsel-muted">New category</p>
            ) : null}
          </FieldShell>
        );
      },
    },
    {
      accessorKey: "amount",
      meta: { label: "Amount", align: "right", width: "6.5rem", skeletonWidth: "60%" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Amount</span>
      ),
      cell: ({ row }) => {
        const issue = fieldIssue(row.original, "amount");
        return (
          <FieldShell issue={issue} className="text-right [&>p]:justify-end">
            <Input
              value={row.original.amount}
              onChange={(e) => onRowChange(row.original.source_row, { amount: e.target.value })}
              disabled={row.original.imported}
              className={cn(fieldInputClass(issue), "tabular-nums text-right")}
              inputMode="decimal"
              aria-invalid={Boolean(issue)}
            />
          </FieldShell>
        );
      },
    },
    {
      accessorKey: "bank",
      meta: { label: "Bank", width: "5.5rem", skeletonWidth: "50%" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Bank</span>
      ),
      cell: ({ row }) => (
        <span className={cn(staticCellClass, "text-xs text-parsel-neutral")}>
          {row.original.bank || "—"}
        </span>
      ),
    },
    {
      accessorKey: "payment_method",
      meta: { label: "Method", width: "7.5rem", skeletonWidth: "60%" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Method</span>
      ),
      cell: ({ row }) => {
        const issue = fieldIssue(row.original, "payment_method");
        return (
          <FieldShell issue={issue}>
            <NativeSelect
              size="xs"
              value={row.original.payment_method ?? ""}
              onChange={(e) =>
                onRowChange(row.original.source_row, {
                  payment_method: e.target.value || null,
                })
              }
              disabled={row.original.imported}
              aria-invalid={Boolean(issue)}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {paymentMethods.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {item}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FieldShell>
        );
      },
    },
    {
      accessorKey: "description",
      meta: { label: "Description", width: "18rem", skeletonWidth: "85%" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Description</span>
      ),
      cell: ({ row }) => (
        <ImportDescriptionField
          value={row.original.description ?? ""}
          expanded={!row.original.imported && !row.original.is_ready}
          disabled={row.original.imported}
          onChange={(next) =>
            onRowChange(row.original.source_row, { description: next })
          }
        />
      ),
    },
    {
      id: "status",
      meta: { label: "Status", width: "5.5rem", skeletonWidth: "4rem" },
      header: () => (
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">Status</span>
      ),
      cell: ({ row }) => {
        if (row.original.imported) {
          return (
            <span
              className={cn(
                staticCellClass,
                "gap-1 text-[10px] font-semibold uppercase tracking-wide text-parsel-muted",
              )}
            >
              <Check className="size-3 shrink-0" aria-hidden />
              Imported
            </span>
          );
        }
        if (row.original.is_ready) {
          return (
            <span
              className={cn(
                staticCellClass,
                "text-[10px] font-semibold uppercase tracking-wide text-parsel-inflow",
              )}
            >
              Ready
            </span>
          );
        }
        return <RowIssuesHint issues={row.original.issues} />;
      },
    },
    ...(onRemoveRow
      ? [
          {
            id: "actions",
            enableSorting: false,
            enableHiding: false,
            meta: { width: "2.25rem" },
            header: () => <span className="sr-only">Remove</span>,
            cell: ({ row }) =>
              row.original.imported ? (
                <span className={staticCellClass} />
              ) : (
                <span className={staticCellClass}>
                  <button
                    type="button"
                    onClick={() => onRemoveRow(row.original.source_row)}
                    className="flex size-6 items-center justify-center rounded-none text-parsel-muted transition hover:bg-parsel-soft hover:text-parsel-outflow"
                    aria-label={`Remove row ${row.original.source_row}`}
                    title="Remove row"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ),
          } as ColumnDef<EditableImportRow>,
        ]
      : []),
  ];
}
