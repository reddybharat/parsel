import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { fetchDashboardOverview } from "../api/dashboard";
import { formatInrAmount, formatInrSigned, formatRelativeDate } from "../lib/format";
import type { DashboardOverview } from "../lib/types";

const CHART_BLUE = "#2563eb";
const CHART_BAR_MUTED = "#e2e8f0";
const CHART_FILL = "rgba(37, 99, 235, 0.18)";

const SECTION_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";
const TREND_MONTHS = 12;
const TILE = "flex min-h-0 flex-col overflow-hidden rounded-xl border border-parsel-border bg-white p-4 shadow-sm";
const TILE_FILL = `${TILE} lg:h-full`;
const CHART_AREA = "h-28 shrink-0 sm:h-32 lg:h-auto lg:min-h-[72px] lg:flex-1 lg:shrink";

type TrendPoint = DashboardOverview["trend"]["points"][number];
type DailyPoint = DashboardOverview["daily_spend"]["points"][number];

function VerticalBarChart({ points }: { points: TrendPoint[] }) {
  if (points.length === 0) {
    return <EmptyState title="No trend data" detail="Add transactions to visualize monthly spend." />;
  }

  const maxSpend = Math.max(...points.map((p) => p.spend), 1);
  const lastIndex = points.length - 1;

  return (
    <div className="flex h-full min-h-[96px] gap-1.5">
      {points.map((point, index) => {
        const isCurrent = index === lastIndex;
        const ratio = point.spend / maxSpend;

        return (
          <div key={`${point.month_label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <div
                className="absolute inset-x-0 bottom-0 rounded-t-[5px]"
                style={{
                  height: point.spend > 0 ? `${Math.max(ratio * 100, 6)}%` : "3px",
                  backgroundColor: isCurrent ? CHART_BLUE : CHART_BAR_MUTED,
                }}
                title={`${point.month_label}: ${formatInrAmount(point.spend)}`}
              />
            </div>
            <span className="mt-1 shrink-0 truncate text-center text-[9px] font-medium uppercase leading-none text-[#94a3b8]">
              {point.month_label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DailySpendChart({ points }: { points: DailyPoint[] }) {
  if (points.length === 0) {
    return <div className="h-full min-h-[96px] rounded-lg bg-[#eef3fa]" />;
  }

  const width = 400;
  const height = 100;
  const paddingX = 8;
  const paddingY = 6;
  const maxDay = points[points.length - 1]?.day ?? 31;
  const maxSpend = Math.max(...points.map((p) => p.spend), 1);
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;

  const coords = points.map((p) => ({
    x: paddingX + ((p.day - 1) / Math.max(maxDay - 1, 1)) * innerW,
    y: paddingY + innerH - (p.spend / maxSpend) * innerH,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.x.toFixed(1) ?? width} ${height - paddingY} L ${coords[0]?.x.toFixed(1) ?? 0} ${height - paddingY} Z`;

  return (
    <div className="flex h-full min-h-[96px] flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Daily Spending Trends"
        >
          <path d={areaPath} fill={CHART_FILL} />
          <path d={linePath} fill="none" stroke={CHART_BLUE} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-1 flex shrink-0 justify-between text-[10px] text-parsel-muted">
        <span>Day 1</span>
        <span>Day 15</span>
        <span>Day {maxDay}</span>
      </div>
    </div>
  );
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
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isUp ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fee2e2] text-[#b91c1c]"
      }`}
    >
      {isUp ? "↑" : "↓"} {label}
    </span>
  );
}

export function OverviewPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchDashboardOverview(TREND_MONTHS, 5);
      setData(overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState label="Loading overview..." />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!data) return null;

  const topCategory = data.highlights.top_category;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:grid-rows-1 lg:overflow-hidden">
      {/* Left: two large graph tiles */}
      <div className="grid min-h-0 gap-3 lg:grid-rows-2 lg:overflow-hidden">
        <article className={TILE_FILL}>
          <p className={`${SECTION_LABEL} shrink-0`}>Net Portfolio Balance</p>
          <div className="mt-1 flex shrink-0 flex-wrap items-center gap-2">
            <p className="font-mono text-xl font-semibold text-parsel-neutral lg:text-2xl">{formatInrSigned(data.summary.portfolio_net)}</p>
            <DeltaBadge value={data.summary.spend_delta_pct} />
          </div>
          <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-parsel-border pt-2">
            <p className={`${SECTION_LABEL} mb-1.5 shrink-0`}>Monthly Spending Trend</p>
            <div className={CHART_AREA}>
              <VerticalBarChart points={data.trend.points} />
            </div>
          </div>
        </article>

        <article className={TILE_FILL}>
          <p className={`${SECTION_LABEL} shrink-0`}>Total Monthly Spending</p>
          <p className="mt-1 shrink-0 font-mono text-xl font-semibold text-parsel-neutral">
            {formatInrAmount(data.summary.current_month_spend)}
          </p>
          <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-parsel-border pt-2">
            <p className={`${SECTION_LABEL} mb-1.5 shrink-0`}>Daily Spending Trends</p>
            <div className={CHART_AREA}>
              <DailySpendChart points={data.daily_spend.points} />
            </div>
          </div>
        </article>
      </div>

      {/* Right column */}
      <div className="grid min-h-0 gap-3 lg:grid-rows-[minmax(0,1.4fr)_auto_auto_minmax(0,0.85fr)] lg:overflow-hidden">
        <article className={`${TILE} min-h-0`}>
          <div className="mb-1.5 flex shrink-0 items-center justify-between">
            <p className={SECTION_LABEL}>Recent Activity</p>
            <Link to="/ledger/search" className="text-[11px] font-semibold text-[#2563eb] hover:underline">
              View All
            </Link>
          </div>
          {data.recent.items.length === 0 ? (
            <EmptyState title="No recent transactions" detail="New entries will show here." />
          ) : (
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
              {data.recent.items.map((row) => (
                <li key={row.id} className="flex items-center gap-2 border-b border-parsel-border pb-1.5 last:border-0 last:pb-0">
                  <ActivityIcon label={row.description || row.category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-tight">{row.description || row.category}</p>
                    <p className="text-[10px] text-parsel-muted">{formatRelativeDate(row.transaction_date)}</p>
                  </div>
                  <p className={`shrink-0 font-mono text-[11px] font-semibold ${row.is_debit ? "text-[#dc2626]" : "text-[#2563eb]"}`}>
                    {row.is_debit ? "−" : "+"} {formatInrAmount(row.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={TILE}>
          <p className={`${SECTION_LABEL} shrink-0`}>Top Category</p>
          {topCategory.category ? (
            <div className="mt-2">
              <p className="text-base font-semibold leading-tight text-parsel-neutral">{topCategory.category}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-[#2563eb]">{formatInrAmount(topCategory.spend)}</p>
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
    </div>
  );
}
