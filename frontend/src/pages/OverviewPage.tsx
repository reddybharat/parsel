import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
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

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";
const TILE = "flex min-h-0 flex-col overflow-hidden rounded-xl border border-parsel-border bg-white p-4 shadow-sm";
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
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef2f7] text-[10px] font-semibold text-parsel-secondary">
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
      className={isUp ? "border-transparent bg-[#dcfce7] text-[#15803d] hover:bg-[#dcfce7]" : "border-transparent bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fee2e2]"}
      variant="secondary"
    >
      {isUp ? "↑" : "↓"} {label}
    </Badge>
  );
}

function TextSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[#e8eef4] ${className ?? ""}`} aria-hidden />;
}

function RecentActivitySkeleton() {
  return (
    <ul className="mt-4 min-h-0 flex-1 space-y-1.5" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-2 pb-1.5">
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-[#e8eef4]" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <TextSkeleton className="h-3 w-3/4" />
            <TextSkeleton className="h-2.5 w-1/3" />
          </div>
          <TextSkeleton className="h-3 w-14" />
        </li>
      ))}
    </ul>
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
  const topCategory = data?.highlights.top_category;
  const trendPoints = data ? ensureCurrentMonthPoint(data.trend.points, TREND_MONTHS) : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:grid-rows-1 lg:overflow-hidden">
      <div className="grid min-h-0 gap-3 lg:grid-rows-2 lg:overflow-hidden">
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

      <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,1.4fr)_auto_auto_minmax(0,0.85fr)] lg:overflow-hidden">
        <article className={`${TILE} min-h-0`}>
          <div className="mb-1.5 flex shrink-0 items-center justify-between">
            <p className={SECTION_LABEL}>Recent Activity</p>
            <Link to="/ledger/search" className="text-[11px] font-semibold text-[#2563eb] hover:underline">
              View All
            </Link>
          </div>
          {showSkeletons ? (
            <RecentActivitySkeleton />
          ) : data && data.recent.items.length === 0 ? (
            <EmptyState title="No recent transactions" detail="New entries will show here." />
          ) : (
            data && (
              <ul className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                {data.recent.items.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 border-b border-parsel-border pb-1.5 last:border-0 last:pb-0">
                    <ActivityIcon label={row.description || row.category} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-tight">{row.description || row.category}</p>
                      <p className="text-[10px] text-parsel-muted">{formatRelativeDate(row.transaction_date)}</p>
                    </div>
                    <p className={`shrink-0 tabular-nums text-[11px] font-semibold ${row.is_debit ? "text-[#dc2626]" : "text-[#2563eb]"}`}>
                      {row.is_debit ? "−" : "+"} {formatInrAmount(row.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )
          )}
        </article>

        <article className={TILE}>
          <p className={`${SECTION_LABEL} shrink-0`}>Top Category</p>
          {showSkeletons ? (
            <div className="mt-2 space-y-2" aria-hidden>
              <TextSkeleton className="h-5 w-28" />
              <TextSkeleton className="h-6 w-24" />
            </div>
          ) : topCategory?.category ? (
            <div className="mt-2">
              <p className="text-base font-semibold leading-tight text-parsel-neutral">{topCategory.category}</p>
              <p className="mt-0.5 tabular-nums text-lg font-semibold text-[#2563eb]">{formatInrAmount(topCategory.spend)}</p>
              <p className="text-[11px] text-parsel-muted">Spent this month</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-parsel-muted">No spending data this month yet.</p>
          )}
        </article>

        <article className={`${TILE} !p-3`}>
          <p className={`${SECTION_LABEL} mb-1.5`}>Quick Actions</p>
          <Link
            to="/ledger/add"
            className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#2563eb] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            <span aria-hidden>+</span> Add Transaction
          </Link>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link
              to="/ledger/add?tab=bulk"
              className="flex items-center justify-center rounded-lg border border-parsel-border px-2 py-1.5 text-[11px] font-medium hover:bg-parsel-soft"
            >
              Bulk Import
            </Link>
            <Link
              to="/ledger/search"
              className="flex items-center justify-center rounded-lg border border-parsel-border px-2 py-1.5 text-[11px] font-medium hover:bg-parsel-soft"
            >
              Search
            </Link>
          </div>
        </article>

        <article className="flex min-h-0 flex-col justify-between rounded-xl bg-[#2563eb] p-3 text-white shadow-sm">
          <div>
            <p className="text-sm font-semibold">Parsel AI</p>
            <p className="mt-0.5 text-xs text-white/90">Ask me anything about your spendings</p>
          </div>
          <Link
            to="/chat"
            className="mt-2 inline-flex w-fit rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/30"
          >
            Chat with AI →
          </Link>
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
