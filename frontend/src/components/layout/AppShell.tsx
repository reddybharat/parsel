import { NavLink } from "react-router-dom";

import { ParselMark } from "@/components/brand/ParselMark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { prefetchDashboardOverview } from "@/lib/dashboardQuery";
import { initialsFromProfile } from "@/lib/profile";
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

function SettingsIcon() {
  return (
    <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const NAV_ITEMS: ShellNavItem[] = [
  { to: "/overview", label: "Home", icon: <HomeIcon /> },
  { to: "/ledger/search", label: "Ledger", icon: <LedgerIcon /> },
  { to: "/ledger/add", label: "Import Data", icon: <ImportIcon /> },
  {
    to: "/chat",
    label: "Parsel AI",
    icon: <ParselMark fit="fitted" strokeWidth={1.25} className="h-[13px] w-[15px]" />,
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { username, email, firstName, lastName } = useAuth();
  const primaryLabel = firstName?.trim() || username || email || "Signed in";
  const secondaryLabel = username ?? email ?? "";
  const initials = initialsFromProfile(firstName, lastName, username ?? email);

  return (
    <div className="flex h-dvh w-full flex-col bg-parsel-bg text-parsel-text">
      <header className="flex w-full shrink-0 items-center justify-between border-b border-parsel-border px-4 py-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[0.08em] uppercase text-parsel-primary">Parsel</h1>
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
                    `flex items-center gap-2.5 rounded-none px-2.5 py-2 text-sm font-medium transition ${
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
              <div className="rounded-none border border-parsel-border bg-parsel-soft p-2.5">
                <div className="flex items-center gap-2.5 px-0.5 py-0.5">
                  <Avatar className="h-8 w-8" aria-hidden>
                    <AvatarFallback className="bg-parsel-avatar-bg text-xs font-semibold text-parsel-secondary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
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
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `shrink-0 rounded-md p-1 transition hover:bg-parsel-surface hover:text-parsel-text ${
                        isActive ? "text-parsel-primary" : "text-parsel-muted"
                      }`
                    }
                    aria-label="Settings"
                  >
                    <SettingsIcon />
                  </NavLink>
                </div>
              </div>
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-parsel-canvas">
          <div className="flex h-full w-full min-h-0 flex-col overflow-hidden px-4 py-3">{children}</div>
        </main>
      </div>
    </div>
  );
}
