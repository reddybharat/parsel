import { NavLink } from "react-router-dom";

type ShellNavItem = {
  to: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: ShellNavItem[] = [
  { to: "/overview", label: "Dashboard", icon: "⌗" },
  { to: "/ledger/search", label: "Transactions", icon: "▦" },
  { to: "/ledger/add", label: "Import Data", icon: "⤴" },
  { to: "/chat", label: "AI Assistant", icon: "✦" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-parsel-bg text-parsel-text">
      <div className="mx-auto min-h-screen w-full max-w-[1280px] p-2 lg:p-3">
        <div className="grid min-h-[calc(100vh-24px)] rounded-xl border border-parsel-border bg-parsel-surface lg:grid-cols-[250px_1fr]">
          <aside className="flex border-r border-parsel-border/80 bg-white">
            <div className="flex min-h-full w-full flex-col p-4">
              <div className="mb-8">
                <h1 className="text-[30px] font-semibold tracking-tight text-parsel-primary">Parsel</h1>
                <p className="text-xs text-parsel-muted">Concierge Service</p>
              </div>
              <nav className="space-y-2">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                        isActive ? "bg-[#e9eef8] text-parsel-primary" : "text-parsel-muted hover:bg-parsel-soft"
                      }`
                    }
                  >
                    <span className="text-xs">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
              <div className="mt-4 border-t border-parsel-border pt-4">
                <p className="flex items-center gap-2 px-3 py-2 text-sm text-parsel-muted">⚙ Settings</p>
              </div>
              <div className="mt-auto border-t border-parsel-border pt-4">
                <div className="rounded-lg bg-[#f7f9fc] p-3">
                  <p className="text-sm font-medium">Premium Tier</p>
                  <p className="text-xs text-parsel-muted">ACTIVE USER</p>
                </div>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-parsel-muted">❔ Support</p>
                  <p className="text-[#d43a3a]">↳ Log Out</p>
                </div>
              </div>
            </div>
          </aside>
          <main className="flex min-h-full flex-col">
            <header className="flex items-center gap-3 border-b border-parsel-border px-5 py-3">
              <div className="hidden rounded-lg border border-parsel-border bg-[#fafbfe] px-3 py-2 text-sm text-parsel-muted md:block md:w-[360px]">
                Search transactions, reports...
              </div>
              <div className="ml-auto flex items-center gap-4 text-parsel-muted">
                <span>🔔</span>
                <span>◌</span>
              </div>
            </header>
            <div className="bg-[#fbfcfe] p-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
