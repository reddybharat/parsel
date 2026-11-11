import { Link } from "react-router-dom";

import { ledgerHref } from "@/components/transactions/LedgerDateRange";
import { formatInrSigned } from "@/lib/format";
import type { DailySpendSeries } from "@/lib/types";

// Distinct hues per bank line; cycles if a user ever exceeds five banks.
export const SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

/** Per-bank balances; in Daily view each row's swatch matches that bank's chart line. */
export function BankBalanceLegend({
  balances,
  series,
  showSwatches,
  start,
  end,
  className = "",
}: {
  balances: Array<{ bank: string; balance: number }>;
  series: DailySpendSeries[];
  showSwatches: boolean;
  start: string;
  end: string;
  className?: string;
}) {
  if (balances.length === 0) return null;

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary">By bank</p>
      <ul className="mt-1.5 min-h-0 overflow-y-auto">
        {balances.map((row) => {
          const lineIndex = series.findIndex((item) => item.bank === row.bank);
          return (
            <li key={row.bank}>
              <Link
                to={ledgerHref({ start, end, bank: row.bank })}
                className="flex items-center gap-2 py-0.5 text-xs hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {showSwatches && lineIndex >= 0 ? (
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-3 shrink-0"
                    style={{ backgroundColor: SERIES_COLORS[lineIndex % SERIES_COLORS.length] }}
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{row.bank}</span>
                <span className="shrink-0 tabular-nums">{formatInrSigned(row.balance)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
