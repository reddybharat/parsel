import { useMemo } from "react";
import { ChevronDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bankInitials, bankLogoSrc } from "@/lib/bankLogos";
import {
  currentMonthValue,
  formatMonthValueLabel,
} from "@/lib/dashboardQuery";
import { cn } from "@/lib/utils";

const TRIGGER_AVATAR_LIMIT = 3;
const CONTROL_WIDTH = "w-[10rem]";

export type SpendChartKind = "daily" | "monthly";

const CHART_OPTIONS: Array<{ value: SpendChartKind; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "monthly", label: "Monthly" },
];

type OverviewPortfolioControlsProps = {
  chart: SpendChartKind;
  onChartChange: (chart: SpendChartKind) => void;
  month: string;
  onMonthChange: (month: string) => void;
  activeBanks: string[];
  selectedBanks: string[];
  onSelectedBanksChange: (banks: string[]) => void;
};

/** Months of the current calendar year, from latest down to January. */
function monthOptions(latest: string): Array<{ value: string; label: string }> {
  const [yearRaw, monthRaw] = latest.split("-");
  const year = Number(yearRaw);
  const latestMonth = Number(monthRaw);
  const options: Array<{ value: string; label: string }> = [];
  for (let month = latestMonth; month >= 1; month -= 1) {
    const value = `${year}-${String(month).padStart(2, "0")}`;
    options.push({ value, label: formatMonthValueLabel(value) });
  }
  return options;
}

export function OverviewPortfolioControls({
  chart,
  onChartChange,
  month,
  onMonthChange,
  activeBanks,
  selectedBanks,
  onSelectedBanksChange,
}: OverviewPortfolioControlsProps) {
  const latestMonth = currentMonthValue();
  const options = useMemo(() => monthOptions(latestMonth), [latestMonth]);
  const selectedSet = useMemo(() => new Set(selectedBanks), [selectedBanks]);
  const allSelected =
    activeBanks.length > 0 && activeBanks.every((bank) => selectedSet.has(bank));
  const bankLabel = allSelected
    ? "All banks"
    : selectedBanks.length === 1
      ? selectedBanks[0]
      : `${selectedBanks.length} banks`;

  function toggleBank(bank: string) {
    if (selectedSet.has(bank)) {
      if (selectedBanks.length <= 1) return;
      onSelectedBanksChange(selectedBanks.filter((item) => item !== bank));
      return;
    }
    const next = activeBanks.filter((item) => item === bank || selectedSet.has(item));
    onSelectedBanksChange(next);
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div role="group" aria-label="Spend chart" className={`flex h-8 ${CONTROL_WIDTH} border border-parsel-border`}>
        {CHART_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={chart === option.value}
            onClick={() => onChartChange(option.value)}
            className={cn(
              "flex-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              chart === option.value
                ? "bg-parsel-soft text-parsel-neutral"
                : "text-parsel-muted hover:text-parsel-neutral",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger
          aria-label="Focus month"
          className={`h-8 ${CONTROL_WIDTH} rounded-none border-parsel-border bg-parsel-surface px-2 text-xs shadow-none`}
        >
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent className="rounded-none" align="end">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="rounded-none text-xs">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeBanks.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Banks: ${allSelected ? "all" : selectedBanks.join(", ")}`}
            className={`flex h-8 ${CONTROL_WIDTH} items-center gap-1.5 border border-parsel-border bg-parsel-surface px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            <AvatarGroup className="shrink-0">
              {selectedBanks.slice(0, TRIGGER_AVATAR_LIMIT).map((bank) => (
                <BankAvatar key={bank} bank={bank} className="size-5" />
              ))}
            </AvatarGroup>
            <span className="min-w-0 flex-1 truncate text-left">{bankLabel}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-0 rounded-none"
          >
            {activeBanks.map((bank) => (
              <DropdownMenuCheckboxItem
                key={bank}
                checked={selectedSet.has(bank)}
                disabled={selectedSet.has(bank) && selectedBanks.length <= 1}
                onCheckedChange={() => toggleBank(bank)}
                onSelect={(event) => event.preventDefault()}
                title={bank}
                className="gap-2 rounded-none pl-2 pr-7 text-xs [&>span:first-child]:left-auto [&>span:first-child]:right-2"
              >
                <BankAvatar bank={bank} className="size-5 shrink-0" />
                <span className="min-w-0 truncate">{bank}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

function BankAvatar({ bank, className }: { bank: string; className?: string }) {
  const src = bankLogoSrc(bank);
  return (
    <Avatar className={cn("rounded-full bg-parsel-surface ring-2 ring-parsel-surface", className)}>
      {src ? (
        <AvatarImage src={src} alt={bank} className="object-cover" />
      ) : null}
      <AvatarFallback className="rounded-full bg-parsel-avatar-bg text-[10px] font-semibold text-parsel-secondary">
        {bankInitials(bank)}
      </AvatarFallback>
    </Avatar>
  );
}
