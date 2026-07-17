import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CashFlowTiles } from "@/components/dashboard/CashFlowTiles";
import { ChartSkeleton } from "@/components/dashboard/ChartSkeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  dashboardOverviewQueryOptions,
  TREND_MONTHS,
} from "@/lib/dashboardQuery";
import { formatInrAmount, formatInrSigned, formatRelativeDate } from "@/lib/format";
import type { DashboardOverview } from "@/lib/types";

const MonthlySpendBarChart = lazy(() =>
  import("@/components/dashboard/MonthlySpendBarChart").then((m) => ({
    default: m.MonthlySpendBarChart,
  })),
);
const DailySpendLineChart = lazy(() =>
  import("@/components/dashboard/DailySpendLineChart").then((m) => ({
    default: m.DailySpendLineChart,
  })),
);
const CategorySpendBarChart = lazy(() =>
  import("@/components/dashboard/CategorySpendBarChart").then((m) => ({
    default: m.CategorySpendBarChart,
  })),
);

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";
const TILE = "flex min-h-0 flex-col overflow-hidden rounded-xl border border-parsel-border bg-parsel-surface p-4 shadow-sm";
const TILE_FILL = `${TILE} lg:h-full`;

type TrendPoint = DashboardOverview["trend"]["points"][number];

function ensureCurrentMonthPoint(points: TrendPoint[], months: number): TrendPoint[] {
  if (points.length === 0) return points;

  const currentMonthLabel = new Date().toLocaleString("en-US", { month: "short" });
  const lastPoint = points[points.length - 1];
  if (lastPoint?.month_label === currentMonthLabel) return points;

  const withCurrentMonth = [...points, { month_label: currentMonthLabel, spend: 0 }];
  if (withCurrentMonth.length <= months) return withCurrentMonth;
  return withCurrentMonth.slice(withCurrentMonth.length - months);
}

function ActivityIcon({ label }: { label: string }) {
  const initial = (label.trim()[0] ?? "?").toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-parsel-icon-bg text-xs font-semibold text-parsel-secondary">
      {initial}
    </span>
  );
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const isUp = value >= 0;
  const label = `${isUp ? "+" : ""}${value.toFixed(1)}%`;
  return (
    <Badge
      className={isUp ? "border-transparent bg-parsel-success-bg text-parsel-success-text hover:bg-parsel-success-bg" : "border-transparent bg-parsel-danger-bg text-parsel-danger-text hover:bg-parsel-danger-bg"}
      variant="secondary"
    >
      {isUp ? "↑" : "↓"} {label}
    </Badge>
  );
}

function TextSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-parsel-soft ${className ?? ""}`} aria-hidden />;
}

function RecentActivitySkeleton() {
  return (
    <ul className="min-h-0 flex-1 space-y-2" aria-hidden>
      {Array.from({ length: 11 }, (_, i) => (
        <li key={i} className="flex items-center gap-2.5 pb-2">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-parsel-soft" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <TextSkeleton className="h-3.5 w-3/4" />
            <TextSkeleton className="h-3 w-1/3" />
          </div>
          <TextSkeleton className="h-3.5 w-16" />
        </li>
      ))}
    </ul>
  );
}

function CashFlowSkeleton({ tileClassName }: { tileClassName: string }) {
  return (
    <div className="grid gap-3" aria-hidden>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className={tileClassName}>
            <TextSkeleton className="h-2.5 w-12" />
            <TextSkeleton className="mt-1.5 h-4 w-16" />
            <TextSkeleton className="mt-1 h-2 w-14" />
          </div>
        ))}
      </div>
      <div className={tileClassName}>
        <TextSkeleton className="h-2.5 w-16" />
        <TextSkeleton className="mt-1.5 h-4 w-16" />
        <TextSkeleton className="mt-1 h-2 w-14" />
      </div>
    </div>
  );
}

function QuickActionsBlock() {
  return (
    <div className="grid min-h-0 gap-3 lg:grid-rows-2 lg:h-full lg:overflow-hidden">
      <article className={`${TILE} flex min-h-0 flex-col !p-3 lg:h-full`}>
        <p className={`${SECTION_LABEL} mb-2 shrink-0`}>Quick Actions</p>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2.5">
          <Button asChild className="w-full">
            <Link to="/ledger/add">
              <Plus />
              Add Transaction
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/ledger/add?tab=bulk">
              <ArrowUp />
              Bulk Import
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/ledger/search">
              <Search />
              Search
            </Link>
          </Button>
        </div>
      </article>

      <article className="flex min-h-0 flex-col justify-between rounded-xl bg-parsel-primary p-3 text-white shadow-sm lg:h-full">
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-tight">Parsel AI</p>
          <p className="text-xs leading-relaxed text-white/90">
            See where your money went this month, or ask about categories and recent transactions.
            Clear answers from your ledger, in plain language.
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="mt-2 w-full border-white/40 bg-parsel-surface text-parsel-primary hover:bg-parsel-surface/90 hover:text-parsel-primary"
        >
          <Link to="/chat">Ask a question</Link>
        </Button>
      </article>
    </div>
  );
}

export function OverviewPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery(dashboardOverviewQueryOptions());

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load overview."}
        onRetry={() => void refetch()}
      />
    );
  }

  const showSkeletons = isPending && !data;
  const trendPoints = data ? ensureCurrentMonthPoint(data.trend.points, TREND_MONTHS) : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)_minmax(280px,340px)] lg:grid-rows-1 lg:overflow-hidden">
      <div className="grid min-h-0 gap-3 lg:grid-rows-2 lg:overflow-hidden lg:h-full">
        <article className={TILE_FILL}>
          <p className={`${SECTION_LABEL} shrink-0`}>Net Portfolio Balance</p>
          <div className="mt-1 flex shrink-0 flex-wrap items-center gap-2">
            {showSkeletons ? (
              <>
                <TextSkeleton className="h-7 w-36 lg:h-8" />
                <TextSkeleton className="h-5 w-16 rounded-full" />
              </>
            ) : (
              data && (
                <>
                  <p className="tabular-nums text-xl font-semibold text-parsel-neutral lg:text-2xl">
                    {formatInrSigned(data.summary.portfolio_net)}
                  </p>
                  <DeltaBadge value={data.summary.spend_delta_pct} />
                </>
              )
            )}
          </div>
          <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-parsel-border pt-2">
            {showSkeletons ? (
              <ChartSkeleton />
            ) : (
              data && (
                <Suspense fallback={<ChartSkeleton />}>
                  <MonthlySpendBarChart points={trendPoints} spendDeltaPct={data.summary.spend_delta_pct} />
                </Suspense>
              )
            )}
          </div>
        </article>

        <article className={TILE_FILL}>
          <p className={`${SECTION_LABEL} shrink-0`}>Total Monthly Spending</p>
          {showSkeletons ? (
            <TextSkeleton className="mt-1 h-7 w-32" />
          ) : (
            data && (
              <p className="mt-1 shrink-0 tabular-nums text-xl font-semibold text-parsel-neutral">
                {formatInrAmount(data.summary.current_month_spend)}
              </p>
            )
          )}
          <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-parsel-border pt-2">
            {showSkeletons ? (
              <ChartSkeleton />
            ) : (
              data && (
                <Suspense fallback={<ChartSkeleton />}>
                  <DailySpendLineChart
                    points={data.daily_spend.points}
                    monthLabel={data.daily_spend.month_label}
                    monthTotal={data.daily_spend.total}
                  />
                </Suspense>
              )
            )}
          </div>
        </article>
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-rows-2 lg:overflow-hidden lg:h-full">
        <article className={TILE_FILL}>
          {showSkeletons ? (
            <ChartSkeleton />
          ) : (
            data && (
              <Suspense fallback={<ChartSkeleton />}>
                <CategorySpendBarChart
                  items={data.category_spend.items}
                  monthLabel={data.daily_spend.month_label}
                />
              </Suspense>
            )
          )}
        </article>
        <QuickActionsBlock />
      </div>

      <div className="grid min-h-0 gap-3 lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden lg:h-full">
        {showSkeletons ? (
          <CashFlowSkeleton tileClassName={TILE} />
        ) : (
          data && (
            <CashFlowTiles
              tileClassName={TILE}
              inflow={data.highlights.total_inflow}
              outflow={data.highlights.total_outflow}
              investments={data.highlights.current_month_investments}
            />
          )
        )}

        <article className={`${TILE} flex min-h-0 flex-col`}>
          <div className="mb-2 flex shrink-0 items-center justify-between border-b border-parsel-border pb-2">
            <p className={SECTION_LABEL}>Recent Activity</p>
            <Link to="/ledger/search" className="text-xs font-semibold text-parsel-inflow hover:underline">
              View All
            </Link>
          </div>
          {showSkeletons ? (
            <RecentActivitySkeleton />
          ) : data && data.recent.items.length === 0 ? (
            <EmptyState title="No recent transactions" detail="New entries will show here." />
          ) : (
            data && (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {data.recent.items.map((row) => (
                  <li key={row.id} className="flex items-center gap-2.5 border-b border-parsel-border pb-2 last:border-0 last:pb-0">
                    <ActivityIcon label={row.description || row.category} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{row.description || row.category}</p>
                      <p className="text-xs text-parsel-muted">{formatRelativeDate(row.transaction_date)}</p>
                    </div>
                    <p className={`shrink-0 tabular-nums text-sm font-semibold ${row.is_debit ? "text-parsel-outflow" : "text-parsel-inflow"}`}>
                      {row.is_debit ? "−" : "+"} {formatInrAmount(row.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )
          )}
        </article>
      </div>

      {isFetching && data && (
        <span className="sr-only" aria-live="polite">
          Refreshing overview
        </span>
      )}
    </div>
  );
}
