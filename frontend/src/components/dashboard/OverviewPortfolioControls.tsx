import { useEffect, useMemo, useRef, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
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

const COLLAPSED_AVATAR_LIMIT = 3;

type OverviewPortfolioControlsProps = {
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
  month,
  onMonthChange,
  activeBanks,
  selectedBanks,
  onSelectedBanksChange,
}: OverviewPortfolioControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const latestMonth = currentMonthValue();
  const options = useMemo(() => monthOptions(latestMonth), [latestMonth]);
  const selectedSet = useMemo(() => new Set(selectedBanks), [selectedBanks]);
  const collapsedBanks = activeBanks.slice(0, COLLAPSED_AVATAR_LIMIT);
  const overflowCount = Math.max(0, activeBanks.length - COLLAPSED_AVATAR_LIMIT);
  const allSelected =
    activeBanks.length > 0 && activeBanks.every((bank) => selectedSet.has(bank));

  useEffect(() => {
    if (!expanded) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setExpanded(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

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
    <div ref={rootRef} className="flex shrink-0 items-center gap-2">
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger
          aria-label="Focus month"
          className="h-8 w-[8.5rem] rounded-none border-parsel-border bg-parsel-surface px-2 text-xs shadow-none"
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
        <div className="relative flex h-8 items-center" role="group" aria-label="Bank filter">
          {!expanded ? (
            <button
              type="button"
              aria-expanded={false}
              aria-label={
                allSelected
                  ? `Banks: all ${activeBanks.length}. Click to expand.`
                  : `Banks: ${selectedBanks.join(", ")}. Click to expand.`
              }
              className="flex h-8 items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-parsel-surface"
              onClick={() => setExpanded(true)}
            >
              <AvatarGroup>
                {collapsedBanks.map((bank) => (
                  <BankAvatar key={bank} bank={bank} className="size-8" />
                ))}
                {overflowCount > 0 ? (
                  <AvatarGroupCount className="size-8">+{overflowCount}</AvatarGroupCount>
                ) : null}
              </AvatarGroup>
            </button>
          ) : (
            <div className="flex h-8 items-center gap-2" aria-expanded={true}>
              {activeBanks.map((bank) => {
                const selected = selectedSet.has(bank);
                return (
                  <button
                    key={bank}
                    type="button"
                    title={bank}
                    aria-label={`${bank}${selected ? ", selected" : ", not selected"}`}
                    aria-pressed={selected}
                    onClick={() => toggleBank(bank)}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-parsel-surface"
                  >
                    <BankAvatar bank={bank} className="size-8" selected={selected} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BankAvatar({
  bank,
  className,
  selected,
}: {
  bank: string;
  className?: string;
  /** When set, renders selection chrome (expanded picker). */
  selected?: boolean;
}) {
  const src = bankLogoSrc(bank);
  const selecting = selected !== undefined;
  return (
    <Avatar
      className={cn(
        "rounded-full bg-parsel-surface ring-2",
        selecting && selected ? "ring-parsel-primary" : "ring-parsel-surface",
        className,
        selecting && !selected && "opacity-50 hover:opacity-85",
      )}
    >
      {src ? (
        <AvatarImage src={src} alt={bank} className="object-cover" />
      ) : null}
      <AvatarFallback className="rounded-full bg-parsel-avatar-bg text-[10px] font-semibold text-parsel-secondary">
        {bankInitials(bank)}
      </AvatarFallback>
    </Avatar>
  );
}
