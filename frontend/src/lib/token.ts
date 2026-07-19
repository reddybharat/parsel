const TOKEN_KEY = "parsel_access_token";

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
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
