import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState } from "@/components/feedback/ErrorState";
import { ledgerHref } from "@/components/transactions/LedgerDateRange";
import { monthlyInsightQueryOptions } from "@/lib/dashboardQuery";

export function MonthlyInsightCard({ month }: { month: string }) {
  const { data, isPending, isError, error, refetch } = useQuery(monthlyInsightQueryOptions(month));

  if (isError) {
    return (
      <div className="mt-2">
        <ErrorState
          message={error instanceof Error ? error.message : "Could not load the insight."}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="mt-2 space-y-2" aria-busy="true" aria-label="Loading insight">
        <div className="h-3 w-full animate-pulse bg-parsel-soft" />
        <div className="h-3 w-4/5 animate-pulse bg-parsel-soft" />
        <div className="h-3 w-3/5 animate-pulse bg-parsel-soft" />
      </div>
    );
  }

  if (!data) {
    return <p className="mt-1 text-sm text-parsel-muted">No spending this month to summarise yet.</p>;
  }

  const { facts } = data;
  return (
    <div className="mt-1 flex min-h-0 flex-col gap-2">
      <p className="text-sm leading-snug text-parsel-neutral">{data.sentence}</p>
      <p className="text-[11px] text-parsel-muted">
        Based on {facts.txn_count} {facts.txn_count === 1 ? "transaction" : "transactions"} ·{" "}
        <Link
          to={ledgerHref({ category: facts.category, start: facts.month_start, end: facts.month_end })}
          className="font-semibold text-parsel-primary hover:underline"
        >
          See them
        </Link>
        {" · "}Generated{" "}
        {new Date(data.generated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {data.questions.map((question) => (
          <li key={question}>
            <Link
              to={`/chat?q=${encodeURIComponent(question)}`}
              className="block border border-parsel-border px-2 py-1 text-left text-xs text-parsel-text transition-[transform,colors] duration-150 ease-out hover:border-parsel-primary hover:text-parsel-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {question}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
