import { clearAccessToken, getAccessToken } from "@/lib/token";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

type Query = Record<string, string | number | boolean | undefined | null>;

function withQuery(path: string, query?: Query): string {
  if (!query) return `${API_BASE_URL}${path}`;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra);
  const token = getAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

function handleUnauthorized(status: number): void {
  if (status !== 401) return;
  clearAccessToken();
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/register")) return;
  const next = encodeURIComponent(path + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

async function parseError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return new Error(body.detail);
    if (Array.isArray(body?.detail)) {
      const first = body.detail[0];
      if (typeof first?.msg === "string") return new Error(first.msg);
    }
  } catch {
    // no-op
  }
  return new Error(`Request failed with status ${response.status}`);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await parseError(response);
  }
  return response.json() as Promise<T>;
}

export async function getJson<T>(path: string, query?: Query): Promise<T> {
  const response = await fetch(withQuery(path, query), {
    headers: authHeaders(),
  });
  return handleResponse<T>(response);
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await parseError(response);
  }
}

export async function getBlob(path: string, query?: Query): Promise<Blob> {
  const response = await fetch(withQuery(path, query), {
    headers: authHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    throw await parseError(response);
  }
  return response.blob();
}

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });
  return handleResponse<T>(response);
}
