import { NavLink, Navigate, Route, Routes } from "react-router-dom";

import { AddPage } from "./pages/AddPage";
import { ChatPage } from "./pages/ChatPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SearchPage } from "./pages/SearchPage";

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium ${
          isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="rounded-lg border border-gray-200 bg-white p-4">
        <h1 className="text-xl font-semibold">Parsel</h1>
        <p className="text-sm text-gray-500">Personal finance tracker</p>
      </header>

      <nav className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <NavItem to="/overview" label="Overview" />
        <NavItem to="/ledger/search" label="Ledger Search" />
        <NavItem to="/ledger/add" label="Ledger Add" />
        <NavItem to="/chat" label="AI Chat" />
      </nav>

      <main className="rounded-lg border border-gray-200 bg-white p-4">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/ledger/search" element={<SearchPage />} />
          <Route path="/ledger/add" element={<AddPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </main>
    </div>
  );
}
