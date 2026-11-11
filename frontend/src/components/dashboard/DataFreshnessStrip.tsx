import { Link } from "react-router-dom";

import { ledgerHref } from "@/components/transactions/LedgerDateRange";
import type { BankFreshness } from "@/lib/types";

const STALE_AFTER_DAYS = 7;
const MS_PER_DAY = 86_400_000;

function calendarDaysAgo(iso: string, now = new Date()): number {
  const then = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thenDay = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((today.getTime() - thenDay.getTime()) / MS_PER_DAY));
}

function addedLabel(days: number): string {
  if (days === 0) return "added today";
  return `added ${days} ${days === 1 ? "day" : "days"} ago`;
}

export function DataFreshnessStrip({ freshness }: { freshness: BankFreshness[] }) {
  if (freshness.length === 0) return null;

  const lastTransaction = freshness
    .map((item) => item.last_transaction_date)
    .filter((date): date is string => date !== null)
    .sort()
    .pop();

  return (
    <section
      aria-label="Data freshness"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-parsel-border bg-parsel-surface px-3 py-1.5 text-xs"
    >
      <span className="font-semibold uppercase tracking-wide text-parsel-secondary">Data</span>
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {freshness.map((item) => {
          const days = item.last_added_at ? calendarDaysAgo(item.last_added_at) : null;
          const stale = days === null || days > STALE_AFTER_DAYS;
          return (
            <li key={item.bank}>
              <Link
                to={stale ? "/ledger/add" : ledgerHref({ bank: item.bank })}
                className="ov-link flex items-center gap-1.5 border border-transparent px-1 py-0.5"
              >
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 ${stale ? "bg-parsel-outflow" : "bg-parsel-inflow"}`}
                />
                <span className="font-medium text-parsel-neutral">{item.bank}</span>
                <span className="text-parsel-muted">
                  {days === null ? "no data yet" : addedLabel(days)}
                </span>
                {stale ? (
                  <span className="font-semibold text-parsel-outflow">stale, import now</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {lastTransaction ? (
        <span className="ml-auto text-parsel-muted">
          Last transaction on file:{" "}
          <span className="font-medium text-parsel-neutral">
            {new Date(`${lastTransaction}T12:00:00`).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </span>
      ) : null}
    </section>
  );
}
