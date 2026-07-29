import type { Table } from "@tanstack/react-table";
import { Download, Plus, RotateCcw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { DataTableFilterSelect } from "@/components/data-table/data-table-filter-select";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LedgerDateRange } from "@/components/transactions/LedgerDateRange";
import type { Category, Transaction } from "@/lib/types";

export type LedgerFilters = {
  startDate: string;
  endDate: string;
  query: string;
  category: string;
  paymentMethod: string;
  /** "" = any, "debit" = money out, "credit" = money in. */
  direction: "" | "debit" | "credit";
};

const DIRECTION_OPTIONS = [
  { value: "debit", label: "Money out" },
  { value: "credit", label: "Money in" },
];

export function LedgerToolbar({
  filters,
  onFiltersChange,
  onReset,
  isDirty,
  invalidRange,
  categories,
  paymentMethods,
  table,
  onExport,
  canExport,
  onSubmit,
}: {
  filters: LedgerFilters;
  onFiltersChange: (next: Partial<LedgerFilters>) => void;
  onReset: () => void;
  isDirty: boolean;
  invalidRange: boolean;
  categories: Category[];
  paymentMethods: string[];
  table: Table<Transaction>;
  onExport: () => void;
  canExport: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[13rem] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-parsel-muted"
          aria-hidden
        />
        <Input
          value={filters.query}
          onChange={(event) => onFiltersChange({ query: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSubmit();
            }
            if (event.key === "Escape" && filters.query) {
              event.preventDefault();
              onFiltersChange({ query: "" });
            }
          }}
          placeholder="Search descriptions, categories, methods…"
          aria-label="Search transactions"
          className="h-8 border-parsel-border pl-8 pr-8 text-xs"
        />
        {filters.query ? (
          <button
            type="button"
            onClick={() => onFiltersChange({ query: "" })}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-parsel-muted transition-colors hover:text-parsel-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <LedgerDateRange
        startDate={filters.startDate}
        endDate={filters.endDate}
        invalid={invalidRange}
        onChange={(start, end) => onFiltersChange({ startDate: start, endDate: end })}
      />

      <DataTableFilterSelect
        label="Category"
        value={filters.category}
        onChange={(value) => onFiltersChange({ category: value })}
        allLabel="All categories"
        options={categories.map((item) => ({ value: item.name, label: item.name }))}
        disabled={categories.length === 0}
      />

      <DataTableFilterSelect
        label="Method"
        value={filters.paymentMethod}
        onChange={(value) => onFiltersChange({ paymentMethod: value })}
        allLabel="All methods"
        options={paymentMethods.map((item) => ({ value: item, label: item }))}
        disabled={paymentMethods.length === 0}
      />

      <DataTableFilterSelect
        label="Type"
        value={filters.direction}
        onChange={(value) => onFiltersChange({ direction: value as LedgerFilters["direction"] })}
        allLabel="Both directions"
        options={DIRECTION_OPTIONS}
      />

      {isDirty ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="h-8 gap-1.5 px-2 text-xs font-normal text-parsel-muted hover:text-parsel-text"
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      ) : null}

      <div className="ml-auto flex items-center gap-1.5">
        <DataTableViewOptions table={table} />
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={!canExport}
          className="h-8 gap-2 text-parsel-muted hover:text-parsel-text"
        >
          <Download />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button asChild size="sm" className="h-8 gap-1.5">
          <Link to="/ledger/add">
            <Plus />
            Add
          </Link>
        </Button>
      </div>
    </div>
  );
}
