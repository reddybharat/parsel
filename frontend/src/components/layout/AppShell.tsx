import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useAuth } from "@/lib/auth";
import { prefetchDashboardOverview } from "@/lib/dashboardQuery";
import { ThemeToggle } from "./ThemeToggle";

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
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H3m12 0l-3.5-3.5M15 12l-3.5 3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h2" />
    </svg>
  );
}

function initialsFromProfile(
  firstName: string | null,
  lastName: string | null,
  username: string | null,
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first && last) {
    return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  }
  if (first) {
    return first.slice(0, 2).toUpperCase();
  }
  if (!username) return "?";
  const parts = username.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

const NAV_ITEMS: ShellNavItem[] = [
  { to: "/overview", label: "Home", icon: <HomeIcon /> },
  { to: "/ledger/search", label: "Ledger", icon: <LedgerIcon /> },
  { to: "/ledger/add", label: "Import Data", icon: <ImportIcon /> },
  { to: "/chat", label: "Parsel AI", icon: <AiIcon /> },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { username, email, firstName, lastName, logout } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const primaryLabel = firstName?.trim() || username || email || "Signed in";
  const secondaryLabel = username ?? email ?? "";
  const initials = initialsFromProfile(firstName, lastName, username ?? email);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-parsel-bg text-parsel-text">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-parsel-border px-4 py-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-parsel-primary">Parsel</h1>
          <p className="text-xs text-parsel-muted">Your personal finance tracker</p>
        </div>
        <ThemeToggle />
      </header>
      <div className="flex min-h-0 w-full flex-1">
        <aside className="flex w-[220px] shrink-0 border-r border-parsel-border bg-parsel-surface">
          <div className="flex min-h-0 w-full flex-col px-3 py-3">
            <nav className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={item.to === "/overview" ? () => void prefetchDashboardOverview() : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                      isActive ? "bg-parsel-nav-active-bg text-parsel-nav-active-text" : "text-parsel-muted hover:bg-parsel-soft hover:text-parsel-text"
                    }`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto border-t border-parsel-border pt-3">
              <div className="rounded-xl border border-parsel-border bg-parsel-soft p-2.5">
                <div className="flex items-center gap-2.5 px-0.5 py-0.5">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-parsel-avatar-bg text-xs font-semibold text-parsel-secondary"
                    aria-hidden
                  >
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight" title={primaryLabel}>
                      {primaryLabel}
                    </p>
                    {secondaryLabel ? (
                      <p className="truncate text-xs leading-tight text-parsel-muted" title={secondaryLabel}>
                        {secondaryLabel}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="shrink-0 rounded-md p-1 text-parsel-muted transition hover:bg-parsel-surface hover:text-parsel-text"
                    aria-label="Settings"
                  >
                    <SettingsIcon />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-parsel-border bg-parsel-surface px-2.5 py-2 text-sm font-medium text-parsel-muted transition hover:border-parsel-danger/40 hover:bg-parsel-danger-bg hover:text-parsel-danger-text"
                >
                  <LogoutIcon />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-parsel-canvas">
          <div className="flex h-full w-full min-h-0 flex-col overflow-hidden px-4 py-3">{children}</div>
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
