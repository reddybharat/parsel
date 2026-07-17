import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { ThemeProvider } from "./lib/theme";
import { AddPage } from "./pages/AddPage";
import { ChatPage } from "./pages/ChatPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SearchPage } from "./pages/SearchPage";
import { queryClient } from "./lib/queryClient";

export default function App() {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <div className="flex h-full min-h-0 flex-col [&>*]:h-full [&>*]:min-h-0">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/ledger/search" element={<SearchPage />} />
            <Route path="/ledger/add" element={<AddPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Routes>
        </div>
      </AppShell>
    </QueryClientProvider>
    </ThemeProvider>
  );
}
