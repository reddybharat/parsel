import { useEffect, useState } from "react";

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

  if (loading) return <p className="text-sm text-gray-500">Loading overview...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  const trendMax = Math.max(...data.trend.points.map((point) => Math.abs(point.spend)), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Overview</h2>
        <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <article className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Current Portfolio</p>
          <p className="text-xl font-semibold">{formatInrSigned(data.summary.portfolio_net)}</p>
        </article>
        <article className="rounded border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Monthly Spend</p>
          <p className="text-xl font-semibold">{formatInrSigned(data.summary.current_month_spend)}</p>
          <p className="text-sm text-gray-500">
            {data.summary.spend_delta_pct === null
              ? "No baseline available"
              : `${data.summary.spend_delta_pct > 0 ? "+" : ""}${data.summary.spend_delta_pct.toFixed(1)}% vs last month`}
          </p>
        </article>
      </div>

      <section className="space-y-2">
        <h3 className="font-medium">Spending Trend</h3>
        <div className="grid gap-2">
          {data.trend.points.map((point) => {
            const width = `${(Math.abs(point.spend) / trendMax) * 100}%`;
            return (
              <div key={point.month_label} className="grid grid-cols-[100px_1fr_120px] items-center gap-2 text-sm">
                <span className="text-gray-500">{point.month_label}</span>
                <div className="h-3 rounded bg-gray-100">
                  <div className="h-3 rounded bg-blue-500" style={{ width }} />
                </div>
                <span className="text-right">{formatInrSigned(Math.abs(point.spend))}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="space-y-2">
          <h3 className="font-medium">Recent Transactions</h3>
          <ul className="divide-y rounded border border-gray-200">
            {data.recent.items.map((row) => (
              <li key={row.id} className="space-y-1 p-3 text-sm">
                <p className="font-medium">
                  {row.transaction_date} - {row.category} - {row.payment_method || "-"}
                </p>
                <p>{formatInrSigned(signedAmount(row.amount, row.is_debit))}</p>
                <p className="text-gray-500">{row.description || "-"}</p>
              </li>
            ))}
          </ul>
        </article>
        <article className="space-y-2 rounded border border-gray-200 p-4 text-sm">
          <h3 className="font-medium">Monthly Insights</h3>
          <p>Top Category: {data.highlights.top_category.category || "-"} ({formatInrSigned(-data.highlights.top_category.spend)})</p>
          <p>Total Inflow: {formatInrSigned(data.highlights.total_inflow)}</p>
          <p>Total Outflow: {formatInrSigned(-data.highlights.total_outflow)}</p>
          <p>Total Investments: {formatInrSigned(data.highlights.current_month_investments)}</p>
        </article>
      </section>
    </div>
  );
}
