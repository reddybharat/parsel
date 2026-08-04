import { QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireProfileBanks } from "./components/auth/RequireProfileBanks";
import { AppShell } from "./components/layout/AppShell";
import { AuthProvider } from "./lib/auth";
import { queryClient } from "./lib/queryClient";
import { ThemeProvider } from "./lib/theme";
import { AddPage } from "./pages/AddPage";
import { AuthPage } from "./pages/AuthPage";
import { BankSetupPage } from "./pages/BankSetupPage";
import { ChatPage } from "./pages/ChatPage";
import { LandingPage } from "./pages/LandingPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SearchPage } from "./pages/SearchPage";
import { SettingsPage } from "./pages/SettingsPage";

function AuthenticatedShell() {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 flex-col [&>*]:h-full [&>*]:min-h-0">
        <Outlet />
      </div>
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<RequireAuth />}>
              <Route path="/setup/banks" element={<BankSetupPage />} />
              <Route element={<RequireProfileBanks />}>
                <Route element={<AuthenticatedShell />}>
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/ledger/search" element={<SearchPage />} />
                  <Route path="/ledger/add" element={<AddPage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
