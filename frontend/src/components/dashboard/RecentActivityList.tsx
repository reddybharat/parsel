import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ledgerHref } from "@/components/transactions/LedgerDateRange";
import { formatInrAmount, formatRelativeDate } from "@/lib/format";
import type { Transaction } from "@/lib/types";

/** Shows as many whole rows as fit the available height (never a partial row). */
export function RecentActivityList({ rows }: { rows: Transaction[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const rowHeightRef = useRef(0);
  const [visible, setVisible] = useState(rows.length);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    function fit() {
      if (!list) return;
      const first = list.firstElementChild as HTMLElement | null;
      if (first) rowHeightRef.current = first.offsetHeight;
      if (rowHeightRef.current === 0) return;
      setVisible(Math.min(rows.length, Math.floor(list.clientHeight / rowHeightRef.current)));
    }
    // Reset to the full list first so the measured height reflects a laid-out row.
    setVisible(rows.length);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [rows.length]);

  return (
    <ul ref={listRef} className="min-h-0 flex-1 overflow-hidden">
      {rows.slice(0, visible).map((row) => {
        const label = row.description || row.category;
        return (
          <li key={row.id} className="border-b border-parsel-border last:border-0">
            <Link
              to={ledgerHref({ q: label, start: row.transaction_date, end: row.transaction_date })}
              className="ov-link flex items-center gap-2.5 border border-transparent px-1 py-2"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-parsel-icon-bg text-xs font-semibold text-parsel-secondary">
                {(label.trim()[0] ?? "?").toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight">{label}</span>
                <span className="block text-xs text-parsel-muted">
                  {formatRelativeDate(row.transaction_date)}
                </span>
              </span>
              <span
                className={`shrink-0 tabular-nums text-sm font-semibold ${row.is_debit ? "text-parsel-outflow" : "text-parsel-inflow"}`}
              >
                {row.is_debit ? "−" : "+"} {formatInrAmount(row.amount)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
