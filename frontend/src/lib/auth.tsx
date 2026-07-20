import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { SessionExpiryDialog } from "@/components/auth/SessionExpiryDialog";
import {
  login as apiLogin,
  refreshSession as apiRefresh,
  register as apiRegister,
} from "@/api/auth";
import { queryClient } from "@/lib/queryClient";
import {
  clearAccessToken,
  decodeTokenClaims,
  getAccessToken,
  getTokenExpiresAt,
  isTokenExpired,
  setAccessToken,
} from "@/lib/token";

/** Show the stay-logged-in prompt this many ms before expiry. */
const SESSION_WARNING_MS = 60_000;

type AuthContextValue = {
  token: string | null;
  username: string | null;
  email: string | null;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [extending, setExtending] = useState(false);

  const setSessionToken = useCallback((next: string) => {
    setAccessToken(next);
    setToken(next);
    setShowExpiryWarning(false);
  }, []);

  const applyToken = useCallback(
    (next: string) => {
      setSessionToken(next);
      // Drop prior-user cache so overview/ledger don't reuse empty/stale data.
      queryClient.clear();
    },
    [setSessionToken],
  );

  const login = useCallback(
    async (loginId: string, password: string) => {
      const result = await apiLogin(loginId, password);
      applyToken(result.access_token);
    },
    [applyToken],
  );

  const register = useCallback(
    async (username: string, email: string, password: string, confirmPassword: string) => {
      const result = await apiRegister(username, email, password, confirmPassword);
      applyToken(result.access_token);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    setShowExpiryWarning(false);
    setExtending(false);
    queryClient.clear();
  }, []);

  const extendSession = useCallback(async () => {
    setExtending(true);
    try {
      const result = await apiRefresh();
      setSessionToken(result.access_token);
    } catch {
      logout();
    } finally {
      setExtending(false);
    }
  }, [setSessionToken, logout]);

  // Warn in the last minute; log out when the token expires.
  useEffect(() => {
    if (!token) {
      setShowExpiryWarning(false);
      return;
    }
    if (isTokenExpired(token)) {
      logout();
      return;
    }
    const expiresAt = getTokenExpiresAt(token);
    if (expiresAt == null) {
      logout();
      return;
    }

    const now = Date.now();
    const warnDelay = Math.max(expiresAt - SESSION_WARNING_MS - now, 0);
    const logoutDelay = Math.max(expiresAt - now, 0);

    const warnTimer = window.setTimeout(() => setShowExpiryWarning(true), warnDelay);
    const logoutTimer = window.setTimeout(() => logout(), logoutDelay);

    return () => {
      window.clearTimeout(warnTimer);
      window.clearTimeout(logoutTimer);
    };
  }, [token, logout]);

  const expiresAt = token ? getTokenExpiresAt(token) : null;
  const valid = Boolean(token && !isTokenExpired(token));

  const value = useMemo<AuthContextValue>(() => {
    const claims = valid && token ? decodeTokenClaims(token) : null;
    return {
      token: valid ? token : null,
      username: claims?.username ?? null,
      email: claims?.email ?? null,
      isAuthenticated: valid,
      login,
      register,
      logout,
    };
  }, [token, valid, login, register, logout]);

  return createElement(
    AuthContext.Provider,
    { value },
    children,
    createElement(SessionExpiryDialog, {
      open: showExpiryWarning && valid,
      expiresAt,
      extending,
      onStayLoggedIn: () => {
        void extendSession();
      },
      onLogout: logout,
    }),
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
