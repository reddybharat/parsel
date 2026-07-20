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
  getMe as apiGetMe,
  login as apiLogin,
  refreshSession as apiRefresh,
  register as apiRegister,
  updateMe as apiUpdateMe,
  type MeResponse,
  type UpdateMePayload,
  type UserPreferences,
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
import { useTheme, type Theme } from "@/lib/theme";

/** Show the stay-logged-in prompt this many ms before expiry. */
const SESSION_WARNING_MS = 60_000;

type AuthContextValue = {
  token: string | null;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  preferences: UserPreferences | null;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => void;
  updateProfile: (payload: UpdateMePayload) => Promise<MeResponse>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function themeFromPreferences(preferences: UserPreferences | null | undefined): Theme | null {
  const theme = preferences?.theme;
  if (theme === "light" || theme === "dark") return theme;
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setTheme } = useTheme();
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [showExpiryWarning, setShowExpiryWarning] = useState(false);
  const [extending, setExtending] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  const applyProfile = useCallback(
    (me: MeResponse) => {
      setFirstName(me.first_name);
      setLastName(me.last_name);
      setPreferences(me.preferences);
      const theme = themeFromPreferences(me.preferences);
      if (theme) setTheme(theme);
    },
    [setTheme],
  );

  const clearProfile = useCallback(() => {
    setFirstName(null);
    setLastName(null);
    setPreferences(null);
  }, []);

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

  const loadProfile = useCallback(async () => {
    const me = await apiGetMe();
    applyProfile(me);
    return me;
  }, [applyProfile]);

  const login = useCallback(
    async (loginId: string, password: string) => {
      const result = await apiLogin(loginId, password);
      applyToken(result.access_token);
      await loadProfile();
    },
    [applyToken, loadProfile],
  );

  const register = useCallback(
    async (username: string, email: string, password: string, confirmPassword: string) => {
      const result = await apiRegister(username, email, password, confirmPassword);
      applyToken(result.access_token);
      await loadProfile();
    },
    [applyToken, loadProfile],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    setShowExpiryWarning(false);
    setExtending(false);
    clearProfile();
    queryClient.clear();
  }, [clearProfile]);

  const updateProfile = useCallback(
    async (payload: UpdateMePayload) => {
      const result = await apiUpdateMe(payload);
      setSessionToken(result.access_token);
      const me: MeResponse = {
        username: result.username,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        preferences: result.preferences,
      };
      applyProfile(me);
      return me;
    },
    [setSessionToken, applyProfile],
  );

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

  // Load profile + default theme when a stored token is present.
  useEffect(() => {
    if (!token || isTokenExpired(token)) return;
    let cancelled = false;
    void (async () => {
      try {
        const me = await apiGetMe();
        if (!cancelled) applyProfile(me);
      } catch {
        // Keep local theme / JWT claims if /me fails; session expiry handles auth.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, applyProfile]);

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
      firstName: valid ? firstName : null,
      lastName: valid ? lastName : null,
      preferences: valid ? preferences : null,
      isAuthenticated: valid,
      login,
      register,
      logout,
      updateProfile,
    };
  }, [token, valid, firstName, lastName, preferences, login, register, logout, updateProfile]);

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
