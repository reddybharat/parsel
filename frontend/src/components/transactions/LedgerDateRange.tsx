import { CalendarRange } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePreset = "today" | "last7" | "last30" | "month" | "lastMonth" | "year";

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "year", label: "This year" },
];

export function localDateIso(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthStartLocal(): string {
  const d = new Date();
  d.setDate(1);
  return localDateIso(d);
}

function presetRange(preset: DatePreset): { start: string; end: string } {
  const today = localDateIso();
  const d = new Date();
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "last7":
      d.setDate(d.getDate() - 6);
      return { start: localDateIso(d), end: today };
    case "last30":
      d.setDate(d.getDate() - 29);
      return { start: localDateIso(d), end: today };
    case "month":
      return { start: monthStartLocal(), end: today };
    case "lastMonth": {
      const start = new Date();
      start.setDate(1);
      start.setMonth(start.getMonth() - 1);
      const end = new Date();
      end.setDate(0);
      return { start: localDateIso(start), end: localDateIso(end) };
    }
    case "year": {
      const start = new Date(d.getFullYear(), 0, 1);
      return { start: localDateIso(start), end: today };
    }
  }
}

function matchPreset(start: string, end: string): DatePreset | null {
  for (const preset of PRESETS) {
    const range = presetRange(preset.id);
    if (range.start === start && range.end === end) return preset.id;
  }
  return null;
}

function formatCompact(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthLabel = date.toLocaleDateString("en-IN", { month: "short" });
  const showYear = year !== new Date().getFullYear();
  return `${String(day).padStart(2, "0")} ${monthLabel}${showYear ? ` ${year}` : ""}`;
}

export function LedgerDateRange({
  startDate,
  endDate,
  onChange,
  invalid = false,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const preset = matchPreset(startDate, endDate);
  const label = preset
    ? PRESETS.find((item) => item.id === preset)?.label
    : `${formatCompact(startDate)} – ${formatCompact(endDate)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-2 border-parsel-border px-2.5 text-xs font-normal text-parsel-text",
            invalid && "border-parsel-danger text-parsel-danger",
          )}
        >
          <CalendarRange className="text-parsel-muted" />
          <span className="whitespace-nowrap tabular-nums">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="grid grid-cols-2 gap-px bg-parsel-border">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const range = presetRange(item.id);
                onChange(range.start, range.end);
                setOpen(false);
              }}
              className={cn(
                "px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
                item.id === preset
                  ? "bg-parsel-nav-active-bg text-parsel-nav-active-text"
                  : "bg-parsel-surface text-parsel-text hover:bg-parsel-soft",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-parsel-border p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-parsel-muted">
            Custom range
          </p>
          <div className="flex items-center gap-1.5">
            <DatePicker
              value={startDate}
              onChange={(value) => onChange(value, endDate)}
              placeholder="Start"
              className="h-8 flex-1 px-2 text-xs"
            />
            <DatePicker
              value={endDate}
              onChange={(value) => onChange(startDate, value)}
              placeholder="End"
              className="h-8 flex-1 px-2 text-xs"
            />
          </div>
          {invalid ? (
            <p className="text-xs text-parsel-danger">Start date must come before the end date.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
