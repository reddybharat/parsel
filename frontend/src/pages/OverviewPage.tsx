import { lazy, Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { BankBalanceLegend } from "@/components/dashboard/BankBalanceLegend";
import { MonthlyInsightCard } from "@/components/dashboard/MonthlyInsightCard";
import { CategoryBudgetCards } from "@/components/dashboard/CategoryBudgetCards";
import { ChartSkeleton } from "@/components/dashboard/ChartSkeleton";
import { DataFreshnessStrip } from "@/components/dashboard/DataFreshnessStrip";
import { OverviewLoading } from "@/components/dashboard/OverviewLoading";
import {
  OverviewPortfolioControls,
  type SpendChartKind,
} from "@/components/dashboard/OverviewPortfolioControls";
import { RecentActivityList } from "@/components/dashboard/RecentActivityList";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ledgerHref, monthRange } from "@/components/transactions/LedgerDateRange";
import {
  currentMonthValue,
  dashboardOverviewQueryOptions,
  TREND_MONTHS,
} from "@/lib/dashboardQuery";
import { formatInrAmount, formatInrSigned } from "@/lib/format";
import { trackerConfigQueryOptions } from "@/lib/trackerConfigQuery";
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

const SPEND_CHART_STORAGE_KEY = "parsel.overview.spendChart";
const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";
const TILE = "flex min-h-0 flex-col overflow-hidden border border-parsel-border bg-parsel-surface p-3";
const INVESTMENTS_CATEGORY = "Investments";

type TrendPoint = DashboardOverview["trend"]["points"][number];

function readSpendChart(): SpendChartKind {
  try {
    return localStorage.getItem(SPEND_CHART_STORAGE_KEY) === "daily" ? "daily" : "monthly";
  } catch {
    return "monthly";
  }
}

function writeSpendChart(chart: SpendChartKind) {
  try {
    localStorage.setItem(SPEND_CHART_STORAGE_KEY, chart);
  } catch {
    // Storage blocked (private window): the choice just isn't remembered.
  }
}

function ensureFocusMonthPoint(
  points: TrendPoint[],
  months: number,
  monthLabel: string,
): TrendPoint[] {
  if (points.length === 0) return points;

  const focusLabel = monthLabel.split(" ")[0] || monthLabel;
  const lastPoint = points[points.length - 1];
  if (lastPoint?.month_label === focusLabel) return points;

  const withFocusMonth = [...points, { month_label: focusLabel, spend: 0 }];
  if (withFocusMonth.length <= months) return withFocusMonth;
  return withFocusMonth.slice(withFocusMonth.length - months);
}

function sameBankSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

/** "YYYY-MM" shifted by a whole number of months. */
function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(year, monthNumber - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): number {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function KpiTile({
  label,
  value,
  valueClassName = "text-parsel-neutral",
  sub,
  to,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  sub?: string;
  to?: string;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between">
        <span className={SECTION_LABEL}>{label}</span>
        {to ? (
          <span aria-hidden="true" className="ov-arrow text-xs text-parsel-primary">
            ↗
          </span>
        ) : null}
      </span>
      <span className={`mt-0.5 block truncate tabular-nums text-lg font-semibold ${valueClassName}`}>
        {value}
      </span>
      <span className="block h-4 truncate text-[11px] text-parsel-muted">{sub}</span>
    </>
  );
  const className = "block min-w-0 border border-parsel-border bg-parsel-surface px-3 py-2";
  return to ? (
    <Link to={to} className={`ov-link ${className}`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function OverviewPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [selectedBanks, setSelectedBanks] = useState<string[] | null>(null);
  const [chart, setChart] = useState<SpendChartKind>(readSpendChart);
  const navigate = useNavigate();

  const { data, isPending, isError, error, refetch, isFetching } = useQuery(
    dashboardOverviewQueryOptions({ month, banks: selectedBanks }),
  );
  const { data: trackerConfig } = useQuery(trackerConfigQueryOptions());

  const activeBanks = data?.active_banks ?? [];
  const displaySelectedBanks = selectedBanks ?? activeBanks;

  useEffect(() => {
    if (!selectedBanks || activeBanks.length === 0) return;
    const pruned = selectedBanks.filter((bank) => activeBanks.includes(bank));
    if (pruned.length === 0 || sameBankSet(pruned, activeBanks)) {
      setSelectedBanks(null);
      return;
    }
    if (!sameBankSet(pruned, selectedBanks)) {
      setSelectedBanks(pruned);
    }
  }, [activeBanks, selectedBanks]);

  function handleSelectedBanksChange(banks: string[]) {
    setSelectedBanks(activeBanks.length > 0 && sameBankSet(banks, activeBanks) ? null : banks);
  }

  function handleChartChange(next: SpendChartKind) {
    setChart(next);
    writeSpendChart(next);
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load overview."}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isPending && !data) {
    return <OverviewLoading />;
  }

  const trendPoints = data
    ? ensureFocusMonthPoint(data.trend.points, TREND_MONTHS, data.daily_spend.month_label)
    : [];
  const categories = trackerConfig?.categories ?? [];
  const importedBanks = trackerConfig?.banks;
  const freshness = (data?.freshness ?? []).filter(
    (item) => !importedBanks || importedBanks.includes(item.bank),
  );

  const monthDays = daysInMonth(month);
  const daysElapsed = month === currentMonthValue() ? new Date().getDate() : monthDays;
  const linkBank = displaySelectedBanks.length === 1 ? displaySelectedBanks[0] : undefined;
  const { start, end } = monthRange(month);
  const monthLink = { start, end, bank: linkBank };

  const spend = data?.summary.current_month_spend ?? 0;
  const inflow = data?.highlights.total_inflow ?? 0;
  const outflow = data?.highlights.total_outflow ?? 0;
  const spendDelta = data?.summary.spend_delta_pct ?? null;
  // shortcut: straight-line pace (spend so far / days elapsed); ignores rent-style lump payments.
  const projectedSpend = daysElapsed < monthDays && spend > 0 ? (spend / daysElapsed) * monthDays : null;
  const limitsTotal = categories.reduce((sum, item) => sum + (item.monthly_limit ?? 0), 0);

  return (
    <div className="ov-grid grid h-full min-h-0 grid-cols-1 content-start gap-1.5 overflow-y-auto">
      <div className="ov-kpis grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label="Spent"
          value={formatInrAmount(spend)}
          sub={
            spendDelta === null
              ? undefined
              : `${spendDelta >= 0 ? "▲" : "▼"} ${Math.abs(spendDelta).toFixed(0)}% vs prev month`
          }
          to={ledgerHref({ ...monthLink, direction: "debit" })}
        />
        <KpiTile
          label="Inflow"
          value={formatInrAmount(inflow)}
          valueClassName="text-parsel-inflow"
          to={ledgerHref({ ...monthLink, direction: "credit" })}
        />
        <KpiTile
          label="Outflow"
          value={formatInrAmount(outflow)}
          valueClassName="text-parsel-outflow"
          to={ledgerHref({ ...monthLink, direction: "debit" })}
        />
        <KpiTile
          label="Invested"
          value={formatInrAmount(data?.highlights.current_month_investments ?? 0)}
          to={ledgerHref({ ...monthLink, category: INVESTMENTS_CATEGORY })}
        />
        <KpiTile
          label="Savings rate"
          value={inflow > 0 ? `${(((inflow - outflow) / inflow) * 100).toFixed(0)}%` : "—"}
          sub={inflow > 0 ? undefined : "No inflow this month"}
        />
        <KpiTile
          label="Per day"
          value={formatInrAmount(spend / daysElapsed)}
          sub={limitsTotal > 0 ? `budget pace ${formatInrAmount(limitsTotal / monthDays)}` : undefined}
        />
      </div>

      <div className="ov-fresh">
        <DataFreshnessStrip freshness={freshness} />
      </div>

      <article className={`ov-balance ${TILE} gap-3 sm:flex-row`}>
        <div className="flex min-h-0 shrink-0 flex-col sm:w-44">
          <p className={SECTION_LABEL}>Net balance</p>
          {data ? (
            <p className="mt-1 tabular-nums text-xl font-semibold text-parsel-neutral">
              {formatInrSigned(data.summary.portfolio_net)}
            </p>
          ) : null}
          {data && data.summary.missing_opening_banks.length > 0 ? (
            <p className="mt-1 text-[11px] leading-snug text-parsel-muted">
              Not counted: {data.summary.missing_opening_banks.join(", ")} (opens later).{" "}
              <Link to="/settings#banks" className="font-semibold text-parsel-primary hover:underline">
                Edit
              </Link>
            </p>
          ) : null}
          {data ? (
            <BankBalanceLegend
              className="mt-3"
              balances={data.summary.bank_balances}
              series={data.daily_spend.series}
              showSwatches={chart === "daily"}
              start={start}
              end={end}
            />
          ) : null}
          {projectedSpend !== null ? (
            <p className="mt-auto pt-2 text-[11px] leading-snug text-parsel-muted">
              Month-end spend at this pace: {formatInrAmount(projectedSpend)}
            </p>
          ) : null}
        </div>
        <div className="ov-balance-chart flex min-h-[9rem] min-w-0 flex-1 flex-col">
          <p className={`${SECTION_LABEL} mb-1 shrink-0`}>
            {chart === "daily" && data
              ? `Daily spend · ${data.daily_spend.month_label}`
              : `Monthly spend · last ${TREND_MONTHS} months`}
          </p>
          <div className="min-h-0 flex-1">
          {data ? (
            <Suspense fallback={<ChartSkeleton />}>
              {chart === "monthly" ? (
                <MonthlySpendBarChart
                  compact
                  points={trendPoints}
                  spendDeltaPct={data.summary.spend_delta_pct}
                  onBarClick={(index) => {
                    const barMonth = shiftMonth(month, index - (trendPoints.length - 1));
                    const range = monthRange(barMonth);
                    navigate(ledgerHref({ ...range, bank: linkBank, direction: "debit" }));
                  }}
                />
              ) : (
                <DailySpendLineChart
                  compact
                  series={data.daily_spend.series}
                  monthLabel={data.daily_spend.month_label}
                  monthTotal={data.daily_spend.total}
                  onDayClick={(day) => {
                    const date = `${month}-${String(day).padStart(2, "0")}`;
                    navigate(ledgerHref({ start: date, end: date, bank: linkBank }));
                  }}
                />
              )}
            </Suspense>
          ) : null}
          </div>
        </div>
        <div className="shrink-0 self-start">
          <OverviewPortfolioControls
            chart={chart}
            onChartChange={handleChartChange}
            month={month}
            onMonthChange={setMonth}
            activeBanks={activeBanks}
            selectedBanks={displaySelectedBanks}
            onSelectedBanksChange={handleSelectedBanksChange}
          />
        </div>
      </article>

      {data ? (
        <CategoryBudgetCards
          className="ov-budgets"
          items={data.category_spend.items}
          categories={categories}
          month={month}
          daysElapsed={daysElapsed}
          bank={linkBank}
        />
      ) : null}

      <div className="ov-side grid min-h-0 gap-1.5">
        <article className={`${TILE} min-h-0`}>
          <p className={SECTION_LABEL}>Insight of the month</p>
          <MonthlyInsightCard month={month} />
        </article>

        <article className={`${TILE} min-h-[12rem]`}>
          <div className="mb-1 flex shrink-0 items-center justify-between border-b border-parsel-border pb-2">
            <p className={SECTION_LABEL}>Recent Activity</p>
            <Link to="/ledger/search" className="text-xs font-semibold text-parsel-primary hover:underline">
              View All
            </Link>
          </div>
          {data && data.recent.items.length === 0 ? (
            <EmptyState title="No recent transactions" detail="New entries will show here." />
          ) : (
            data && <RecentActivityList rows={data.recent.items} />
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
