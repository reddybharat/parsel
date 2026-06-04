import { NavLink } from "react-router-dom";

type ShellNavItem = {
  to: string;
  label: string;
  icon: string;
};

const NAV_ITEMS: ShellNavItem[] = [
  { to: "/overview", label: "Dashboard", icon: "⌗" },
  { to: "/ledger/search", label: "Ledger", icon: "▦" },
  { to: "/ledger/add", label: "Import Data", icon: "⤴" },
  { to: "/chat", label: "AI Assistant", icon: "✦" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-white text-parsel-text">
      <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col">
        <header className="flex shrink-0 items-center border-b border-parsel-border px-5 py-3">
          <div>
            <h1 className="text-[30px] font-semibold tracking-tight text-parsel-primary">Parsel</h1>
            <p className="text-xs text-parsel-muted">Your personal finance tracker</p>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[250px] shrink-0 border-r border-parsel-border bg-white">
            <div className="flex min-h-0 w-full flex-col p-4">
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
                <div className="rounded-lg bg-parsel-soft p-3">
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
          <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#fbfcfe]">
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
