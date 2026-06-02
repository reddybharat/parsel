import { useEffect, useState } from "react";

import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { fetchDashboardOverview } from "../api/dashboard";
import { formatInrSigned, signedAmount } from "../lib/format";
import type { DashboardOverview } from "../lib/types";

export function OverviewPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const overview = await fetchDashboardOverview(6, 4);
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

  const trendMax = Math.max(...data.trend.points.map((point) => Math.abs(point.spend)), 1);
  const topCategorySpend = formatInrSigned(-data.highlights.top_category.spend);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[44px] font-semibold tracking-tight text-parsel-neutral">Financial Overview</h2>
        <p className="text-sm text-parsel-muted">Welcome back. Here&apos;s your portfolio at a glance.</p>
      </div>

      <section className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
        <article className="rounded-xl border border-parsel-border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Net Portfolio Balance</p>
            <span className="rounded-full bg-[#f9d79b] px-3 py-1 text-xs font-semibold text-[#6b4a14]">
              {data.summary.spend_delta_pct === null ? "No baseline" : `${data.summary.spend_delta_pct > 0 ? "+" : ""}${data.summary.spend_delta_pct.toFixed(1)}% vs last month`}
            </span>
          </div>
          <p className="font-mono text-5xl font-semibold text-[#0b5fa5]">{formatInrSigned(data.summary.portfolio_net)}</p>
          <div className="mt-4 h-[108px] rounded-lg bg-gradient-to-t from-[#b8d7ef] to-[#dcebfa]" />
        </article>
        <div className="grid gap-3">
          <article className="rounded-xl border border-parsel-border bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Top Category</p>
            <p className="mt-3 text-2xl font-semibold">{data.highlights.top_category.category || "-"}</p>
            <p className="text-sm text-parsel-muted">{topCategorySpend} spent</p>
          </article>
          <article className="rounded-xl border border-[#9fc3dc] bg-[#b8d7ea] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#335168]">Investments</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-[#345773]">
              {formatInrSigned(data.highlights.current_month_investments)}
            </p>
            <p className="text-sm text-[#48667d]">Allocated this month</p>
          </article>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.7fr_1fr]">
        <article className="rounded-xl border border-parsel-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Spending Trends</p>
              <p className="font-mono text-2xl font-semibold">{formatInrSigned(data.summary.current_month_spend)}</p>
              <p className="text-xs text-parsel-muted">Current month</p>
            </div>
            <button className="rounded-md border border-parsel-border px-2 py-1 text-xs" onClick={() => void load()}>
              Refresh
            </button>
          </div>
          {data.trend.points.length === 0 ? (
            <EmptyState title="No trend data" detail="Add transactions to visualize monthly spend." />
          ) : (
            <div className="grid gap-2">
              {data.trend.points.map((point) => {
                const width = `${(Math.abs(point.spend) / trendMax) * 100}%`;
                return (
                  <div key={point.month_label} className="grid grid-cols-[80px_1fr_120px] items-center gap-2 text-sm">
                    <span className="text-parsel-muted">{point.month_label}</span>
                    <div className="h-2 rounded-full bg-[#e8eef6]">
                      <div className="h-2 rounded-full bg-parsel-primary" style={{ width }} />
                    </div>
                    <span className="text-right font-mono">{formatInrSigned(Math.abs(point.spend))}</span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
        <article className="rounded-xl border border-parsel-border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-parsel-secondary">Recent Activity</p>
            <span className="text-xs text-parsel-primary">View All</span>
          </div>
          {data.recent.items.length === 0 ? (
            <EmptyState title="No recent transactions" detail="New entries will show here." />
          ) : (
            <ul className="space-y-3">
              {data.recent.items.map((row) => (
                <li key={row.id} className="flex items-center justify-between border-b border-parsel-border pb-2 text-sm last:border-0">
                  <div>
                    <p className="font-medium">{row.description || row.category}</p>
                    <p className="text-xs text-parsel-muted">{row.transaction_date}</p>
                  </div>
                  <p className={`font-mono font-semibold ${row.is_debit ? "text-[#cc3d3d]" : "text-[#0f6cc6]"}`}>
                    {formatInrSigned(signedAmount(row.amount, row.is_debit))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="flex items-center justify-between rounded-xl bg-[#151b24] p-6 text-white">
        <div>
          <p className="text-4xl font-semibold">Chat with your data</p>
          <p className="mt-2 text-sm text-[#c7d4e8]">Get instant answers about spending, tax savings, and investment growth.</p>
        </div>
        <button className="rounded-lg bg-parsel-primary px-6 py-3 text-base font-semibold">Open Assistant</button>
      </section>
    </div>
  );
}
