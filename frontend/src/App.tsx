import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { AddPage } from "./pages/AddPage";
import { ChatPage } from "./pages/ChatPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SearchPage } from "./pages/SearchPage";

export default function App() {
  return (
    <AppShell>
      <div className="space-y-4">
        <Routes>
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<OverviewPage />} />
          <Route path="/ledger/search" element={<SearchPage />} />
          <Route path="/ledger/add" element={<AddPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </div>
    </AppShell>
  );
}
