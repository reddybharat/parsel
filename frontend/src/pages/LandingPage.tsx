/**
 * THESIS: Separate marketing landing that proves Parsel's INR ledger + chat, then sends visitors to dedicated auth.
 * OWN-WORLD: Mono Signal × Precision Cyan — canvas/surface, hairline borders, JetBrains Mono, cyan CTAs only.
 * STORY: Visitor understands Overview / chat / CSV import, then creates an account or signs in.
 * FIRST VIEWPORT: Brand + headline + short support + Create account / Sign in; theme toggle in nav.
 * FORM: Landing-separate (A) from mockups; auth remains D on /login and /register.
 */
import { Link, Navigate } from "react-router-dom";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SECTION_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-parsel-secondary";
const TILE = "rounded-none border border-parsel-border bg-parsel-surface p-3 shadow-none";

function LandingCtas({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button asChild className="rounded-none shadow-none">
        <Link to="/register">Create account</Link>
      </Button>
      <Button asChild variant="outline" className="rounded-none shadow-none">
        <Link to="/login">Sign in</Link>
      </Button>
    </div>
  );
}

function OverviewPreview() {
  return (
    <div className="grid gap-1.5 text-parsel-text lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-1.5">
        <article className={TILE}>
          <p className={SECTION_LABEL}>Net Portfolio Balance</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="tabular-nums text-xl font-semibold text-parsel-neutral lg:text-2xl">
              +₹2,14,680
            </p>
            <span className="rounded-none border border-transparent bg-parsel-danger-bg px-1.5 py-0.5 text-[10px] font-medium text-parsel-danger-text">
              ↓ 4.2%
            </span>
          </div>
          <p className="mt-1 text-[10px] text-parsel-muted">Spend vs last month</p>
        </article>

        <div className="grid grid-cols-2 gap-1.5">
          <article className={TILE}>
            <p className={SECTION_LABEL}>Inflow</p>
            <p className="mt-0.5 truncate tabular-nums text-sm font-semibold text-parsel-inflow">
              ₹1,12,400
            </p>
            <p className="text-[10px] text-parsel-muted">This month</p>
          </article>
          <article className={TILE}>
            <p className={SECTION_LABEL}>Outflow</p>
            <p className="mt-0.5 truncate tabular-nums text-sm font-semibold text-parsel-outflow">
              ₹68,920
            </p>
            <p className="text-[10px] text-parsel-muted">This month</p>
          </article>
        </div>

        <article className={TILE}>
          <p className={SECTION_LABEL}>Investments</p>
          <p className="mt-0.5 truncate tabular-nums text-sm font-semibold text-parsel-neutral">
            ₹42,000
          </p>
          <p className="text-[10px] text-parsel-muted">This month</p>
        </article>

        <article className={TILE}>
          <p className={SECTION_LABEL}>Monthly spend</p>
          <div className="mt-3 flex h-24 items-end gap-1.5" aria-hidden>
            {[
              { month: "Feb", h: 40 },
              { month: "Mar", h: 55 },
              { month: "Apr", h: 48 },
              { month: "May", h: 72 },
              { month: "Jun", h: 62 },
              { month: "Jul", h: 58 },
            ].map((bar) => (
              <div key={bar.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div
                  className="w-full bg-parsel-primary"
                  style={{ height: `${bar.h}%` }}
                  title={bar.month}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-parsel-muted">
            <span>Feb</span>
            <span>Jul</span>
          </div>
        </article>
      </div>

      <article className={cn(TILE, "flex flex-col")}>
        <p className={SECTION_LABEL}>Recent activity</p>
        <ul className="mt-3 space-y-2">
          {[
            { n: "Swiggy", m: "Food", a: "−₹420", neg: true },
            { n: "Salary", m: "Income", a: "+₹95,000", neg: false },
            { n: "Zerodha", m: "Investments", a: "−₹10,000", neg: true },
            { n: "Metro", m: "Travel", a: "−₹60", neg: true },
          ].map((row) => (
            <li key={row.n} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-parsel-icon-bg text-xs font-semibold text-parsel-secondary">
                {row.n[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.n}</p>
                <p className="text-[10px] text-parsel-muted">{row.m}</p>
              </div>
              <span
                className={cn(
                  "tabular-nums text-sm font-medium",
                  row.neg ? "text-parsel-outflow" : "text-parsel-inflow",
                )}
              >
                {row.a}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="flex flex-col gap-3 rounded-none border border-parsel-border bg-parsel-surface p-4 shadow-none">
      <div className="ml-auto max-w-[85%] rounded-none border border-parsel-border bg-parsel-canvas px-3 py-2 text-sm text-parsel-text">
        How much on groceries in June?
      </div>
      <div className="max-w-[90%] rounded-none border border-parsel-border bg-parsel-surface px-3 py-2 text-sm text-parsel-text">
        <p className="text-parsel-muted">From your ledger</p>
        <p className="mt-1 font-semibold">
          Groceries in Jun 2026: <span className="text-parsel-outflow">₹8,940</span>
        </p>
        <p className="mt-2 text-xs text-parsel-muted">
          14 transactions · top merchant: BigBasket (₹3,210)
        </p>
      </div>
      <div className="ml-auto max-w-[85%] rounded-none border border-parsel-border bg-parsel-canvas px-3 py-2 text-sm text-parsel-text">
        And vs May?
      </div>
      <div className="max-w-[90%] rounded-none border border-parsel-border bg-parsel-surface px-3 py-2 text-sm text-parsel-text">
        May was <span className="text-parsel-outflow">₹7,120</span> — June is{" "}
        <span className="text-parsel-outflow">+25.6%</span>.
      </div>
    </div>
  );
}

function ImportPreview() {
  return (
    <div className="rounded-none border border-parsel-border bg-parsel-surface p-4 text-sm text-parsel-text shadow-none">
      <p className={SECTION_LABEL}>Bulk import</p>
      <p className="mt-2 font-semibold">transactions_jun2026.csv</p>
      <p className="mt-1 text-parsel-muted">Template download → upload → map columns</p>
      <div className="mt-4 h-2 w-full bg-parsel-soft" aria-hidden>
        <div className="h-2 w-3/4 bg-parsel-primary" />
      </div>
    </div>
  );
}

const PROOF_BANDS = [
  {
    title: "Overview you can trust",
    body: "Net portfolio, inflow / outflow / investments, spend charts, and recent activity — the same shape as the signed-in Overview.",
    visual: <OverviewPreview />,
  },
  {
    title: "Ask instead of digging",
    body: "Natural-language questions answered from your own transaction history. Chat stays read-only.",
    visual: <ChatPreview />,
  },
  {
    title: "Import a month in one pass",
    body: "CSV template download and upload inside the add-transaction flow.",
    visual: <ImportPreview />,
  },
] as const;

export function LandingPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return (
    <div className="min-h-dvh bg-parsel-canvas text-parsel-text">
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-parsel-border bg-parsel-surface px-6 py-3 lg:px-14">
        <Link
          to="/"
          className="text-lg font-semibold uppercase tracking-[0.08em] text-parsel-primary"
        >
          Parsel
        </Link>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <LandingCtas className="hidden sm:flex" />
        </div>
      </nav>

      <section className="landing-hero px-6 py-16 lg:px-14 lg:py-24">
        <p className="text-[48px] font-semibold uppercase tracking-[0.08em] text-parsel-primary lg:text-[64px]">
          Parsel
        </p>
        <h1 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-parsel-text lg:text-5xl">
          Operate your cash flow in ₹.
        </h1>
        <p className="mt-4 max-w-lg text-sm text-parsel-muted lg:text-base">
          Log spending, search your ledger, and ask plain-language questions over your own
          transactions — scoped to you.
        </p>
        <LandingCtas className="mt-8" />
      </section>

      {PROOF_BANDS.map((band) => (
        <section
          key={band.title}
          className="landing-band border-t border-parsel-border px-6 py-14 lg:px-14 lg:py-16"
        >
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <h2 className="text-2xl font-semibold text-parsel-text">{band.title}</h2>
              <p className="mt-3 max-w-md text-sm text-parsel-muted">{band.body}</p>
              <p className="mt-4 text-[10px] uppercase tracking-[0.08em] text-parsel-muted">
                Sample data · illustrative
              </p>
            </div>
            <div>{band.visual}</div>
          </div>
        </section>
      ))}

      <section className="border-t border-parsel-border bg-parsel-surface px-6 py-16 lg:px-14">
        <h2 className="text-2xl font-semibold text-parsel-text">Open your ledger</h2>
        <p className="mt-2 max-w-md text-sm text-parsel-muted">
          Create an account or sign in to start tracking INR cash flow.
        </p>
        <LandingCtas className="mt-6" />
      </section>
    </div>
  );
}
