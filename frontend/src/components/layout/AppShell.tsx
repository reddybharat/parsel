import { NavLink } from "react-router-dom";

import { prefetchDashboardOverview } from "@/lib/dashboardQuery";

type ShellNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const ICON_CLASS = "h-[18px] w-[18px] shrink-0";

function HomeIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" />
    </svg>
  );
}

function LedgerIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12v16H6V4z" />
      <path strokeLinecap="round" d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V6m0 0l-3.5 3.5M12 6l3.5 3.5" />
      <path strokeLinecap="round" d="M5 18h14" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.1 3.4 3.5 1.1-3.5 1.1L12 11l-1.1-3.4-3.5-1.1 3.5-1.1L12 2zm0 10l.8 2.4 2.5.8-2.5.8-.8 2.4-.8-2.4-2.5-.8 2.5-.8.8-2.4z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m12 0l-3-3m3 3l-3 3M7 5h4a2 2 0 012 2v10a2 2 0 01-2 2H7" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path strokeLinecap="round" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

const NAV_ITEMS: ShellNavItem[] = [
  { to: "/overview", label: "Home", icon: <HomeIcon /> },
  { to: "/ledger/search", label: "Ledger", icon: <LedgerIcon /> },
  { to: "/ledger/add", label: "Import Data", icon: <ImportIcon /> },
  { to: "/chat", label: "Parsel AI", icon: <AiIcon /> },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col bg-white text-parsel-text">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-parsel-border px-4 py-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#2563eb]">Parsel</h1>
          <p className="text-xs text-parsel-muted">Your personal finance tracker</p>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-parsel-muted hover:bg-parsel-soft disabled:opacity-50"
          disabled
          aria-label="Theme (coming soon)"
          title="Theme (coming soon)"
        >
          <SunIcon />
        </button>
      </header>
      <div className="flex min-h-0 w-full flex-1">
        <aside className="flex w-[220px] shrink-0 border-r border-parsel-border bg-white">
          <div className="flex min-h-0 w-full flex-col px-3 py-3">
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={item.to === "/overview" ? () => void prefetchDashboardOverview() : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                      isActive ? "bg-[#e8eef8] text-[#2563eb]" : "text-parsel-muted hover:bg-parsel-soft hover:text-parsel-text"
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto space-y-0">
              <p className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-parsel-muted">
                <SettingsIcon />
                Settings
              </p>
              <div className="border-t border-parsel-border pt-3">
                <div className="flex items-center gap-2.5 rounded-xl border border-parsel-border bg-parsel-soft p-2.5">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dbe4f0] text-xs font-semibold text-parsel-secondary"
                    aria-hidden
                  >
                    AU
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Active User</p>
                    <p className="text-xs text-parsel-muted">Premium Plan</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[#dc2626] hover:text-[#b91c1c] disabled:opacity-50"
                    disabled
                    aria-label="Log out (coming soon)"
                    title="Log out (coming soon)"
                  >
                    <LogoutIcon />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f6f8fb]">
          <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col overflow-hidden px-4 py-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
