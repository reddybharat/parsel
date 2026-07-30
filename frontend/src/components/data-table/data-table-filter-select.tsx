import { Check, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type FilterOption = { value: string; label: string };

/** Single-select toolbar filter; active values invert so the toolbar reads at a glance. */
export function DataTableFilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel = "All",
  disabled = false,
}: {
  label: string;
  /** Empty string means no filter. */
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  allLabel?: string;
  disabled?: boolean;
}) {
  const active = value !== "";
  const selected = options.find((option) => option.value === value);

  return (
    <div className="flex items-stretch">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-8 max-w-[13rem] gap-1.5 border-parsel-border px-2.5 text-xs font-normal",
              active
                ? "border-parsel-nav-active-bg bg-parsel-nav-active-bg text-parsel-nav-active-text hover:bg-parsel-nav-active-bg hover:text-parsel-nav-active-text"
                : "text-parsel-muted hover:text-parsel-text",
              active && "border-r-0",
            )}
          >
            <span className="truncate">
              {active ? `${label}: ${selected?.label ?? value}` : label}
            </span>
            {active ? null : <ChevronDown className="opacity-50" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onChange("")} className="justify-between">
            {allLabel}
            {active ? null : <Check className="size-3.5" strokeWidth={3} />}
          </DropdownMenuItem>
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="justify-between gap-2"
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <Check className="size-3.5 shrink-0" strokeWidth={3} /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {active ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`Clear ${label} filter`}
          className="flex h-8 items-center border border-l-0 border-parsel-nav-active-bg bg-parsel-nav-active-bg pr-2 text-parsel-nav-active-text transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
