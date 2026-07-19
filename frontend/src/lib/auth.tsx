import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { login as apiLogin, register as apiRegister } from "@/api/auth";
import { queryClient } from "@/lib/queryClient";
import {
  clearAccessToken,
  decodeTokenClaims,
  getAccessToken,
  setAccessToken,
} from "@/lib/token";

type AuthContextValue = {
  token: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());

  const applyToken = useCallback((next: string) => {
    setAccessToken(next);
    setToken(next);
    // Drop prior-user cache so overview/ledger don't reuse empty/stale data.
    queryClient.clear();
  }, []);

  const login = useCallback(
    async (loginId: string, password: string) => {
      const result = await apiLogin(loginId, password);
      applyToken(result.access_token);
    },
    [applyToken],
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const result = await apiRegister(username, email, password);
      applyToken(result.access_token);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    queryClient.clear();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const claims = token ? decodeTokenClaims(token) : null;
    return {
      token,
      username: claims?.username ?? null,
      email: claims?.email ?? null,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
    };
  }, [token, login, register, logout]);

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
