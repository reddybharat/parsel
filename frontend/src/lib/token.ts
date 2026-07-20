const TOKEN_KEY = "parsel_access_token_v2";

export function getAccessToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiresAt = getTokenExpiresAt(token);
  if (expiresAt == null) return true;
  return Date.now() >= expiresAt;
}

export function getTokenExpiresAt(token: string): number | null {
  const json = decodePayload(token);
  const exp = json?.exp;
  if (typeof exp !== "number") return null;
  return exp * 1000;
}

export function decodeTokenClaims(token: string): {
  username: string | null;
  email: string | null;
} {
  const json = decodePayload(token);
  return {
    username: typeof json?.username === "string" ? json.username : null,
    email: typeof json?.email === "string" ? json.email : null,
  };
}
