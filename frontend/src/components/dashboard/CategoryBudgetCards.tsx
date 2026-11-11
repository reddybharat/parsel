import { Link } from "react-router-dom";

import { EmptyState } from "@/components/feedback/EmptyState";
import { ledgerHref, monthRange } from "@/components/transactions/LedgerDateRange";
import { formatInrAmount } from "@/lib/format";
import type { Category, DashboardOverview } from "@/lib/types";

const MAX_CARDS = 8;
const NEAR_LIMIT_PCT = 90;

type SpendItem = DashboardOverview["category_spend"]["items"][number];

type Card = {
  category: string;
  spend: number;
  prevSpend: number;
  limit: number | null;
};

function buildCards(items: SpendItem[], categories: Category[]): Card[] {
  const spendByCategory = new Map(items.map((item) => [item.category, item]));
  const limited: Card[] = categories
    .filter((category) => category.monthly_limit !== null)
    .map((category) => {
      const item = spendByCategory.get(category.name);
      return {
        category: category.name,
        spend: item?.spend ?? 0,
        prevSpend: item?.prev_spend ?? 0,
        limit: category.monthly_limit,
      };
    })
    .sort((a, b) => b.spend / (b.limit ?? 1) - a.spend / (a.limit ?? 1));
  const limitedNames = new Set(limited.map((card) => card.category));
  const unlimited: Card[] = items
    .filter((item) => !limitedNames.has(item.category))
    .map((item) => ({
      category: item.category,
      spend: item.spend,
      prevSpend: item.prev_spend,
      limit: null,
    }));
  return [...limited, ...unlimited].slice(0, MAX_CARDS);
}

function statusFor(pct: number): { label: string; className: string } {
  if (pct > 100) return { label: "over", className: "border-parsel-outflow text-parsel-outflow" };
  if (pct >= NEAR_LIMIT_PCT) {
    return { label: "near limit", className: "border-parsel-outflow/60 text-parsel-outflow" };
  }
  return { label: "on track", className: "border-parsel-border text-parsel-muted" };
}

function Delta({ spend, prevSpend }: { spend: number; prevSpend: number }) {
  if (prevSpend <= 0) return null;
  const pct = ((spend - prevSpend) / prevSpend) * 100;
  const up = pct >= 0;
  return (
    <span className={up ? "text-parsel-outflow" : "text-parsel-inflow"}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {Math.abs(pct).toFixed(0)}%
      <span className="sr-only"> {up ? "up" : "down"} vs previous month</span>
    </span>
  );
}

export function CategoryBudgetCards({
  items,
  categories,
  month,
  daysElapsed,
  bank,
  className,
}: {
  items: SpendItem[];
  categories: Category[];
  month: string;
  daysElapsed: number;
  bank?: string;
  className?: string;
}) {
  const cards = buildCards(items, categories);
  if (cards.length === 0) {
    return (
      <div className={`${className} col-span-full row-span-full border border-parsel-border bg-parsel-surface p-3`}>
        <EmptyState title="No spending this month" detail="Spend by category shows here once you add transactions." />
      </div>
    );
  }

  const { start, end } = monthRange(month);
  return (
    <div className={className}>
      {cards.map((card) => {
        const pct = card.limit === null ? null : (card.spend / card.limit) * 100;
        const status = pct === null ? null : statusFor(pct);
        const remaining = card.limit === null ? null : card.limit - card.spend;
        const leftLabel =
          remaining === null
            ? null
            : remaining >= 0
              ? `${formatInrAmount(remaining)} left`
              : `${formatInrAmount(remaining)} over`;
        return (
          <div
            key={card.category}
            className="ov-link ov-cell relative flex min-h-0 flex-col justify-between gap-1 overflow-hidden border border-parsel-border bg-parsel-surface p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <Link
                to={ledgerHref({ category: card.category, start, end, bank })}
                className="min-w-0 truncate text-sm font-semibold text-parsel-neutral after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                {card.category}
              </Link>
              <span className="flex shrink-0 items-center gap-2 text-[11px]">
                <span className="ov-lt105">
                  <Delta spend={card.spend} prevSpend={card.prevSpend} />
                </span>
                {status ? (
                  <span className={`border px-1 leading-4 ${status.className}`}>{status.label}</span>
                ) : null}
              </span>
            </div>

            <p className="truncate text-xs text-parsel-muted">
              <span className="tabular-nums text-base font-semibold text-parsel-neutral">
                {formatInrAmount(card.spend)}
              </span>{" "}
              {card.limit === null ? (
                <>
                  No limit ·{" "}
                  <Link
                    to="/settings#categories"
                    className="relative z-10 font-semibold text-parsel-primary hover:underline"
                  >
                    Set limit
                  </Link>
                </>
              ) : (
                <>
                  of {formatInrAmount(card.limit)} · {Math.round(pct ?? 0)}%
                  <span className="ov-lt130"> · {leftLabel}</span>
                </>
              )}
            </p>

            {pct !== null ? (
              <div
                role="progressbar"
                aria-label={`${card.category} budget used`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.round(pct))}
                className="h-1.5 w-full shrink-0 bg-parsel-soft"
              >
                <div
                  className={`h-full ${pct > 100 ? "bg-parsel-outflow" : "bg-parsel-primary"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            ) : null}

            <p className="ov-mid truncate text-[11px] text-parsel-muted">
              <Delta spend={card.spend} prevSpend={card.prevSpend} />
              {card.prevSpend > 0 ? " vs previous month" : "No spend previous month"}
            </p>

            <p className="ov-full flex items-center justify-between gap-2 text-[11px] text-parsel-muted">
              <span className="tabular-nums">{formatInrAmount(card.spend / daysElapsed)}/day</span>
              {leftLabel ? <span className="tabular-nums">{leftLabel}</span> : null}
            </p>
          </div>
        );
      })}
    </div>
  );
}
