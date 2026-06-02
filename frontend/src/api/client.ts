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

async function parseError(response: Response): Promise<Error> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return new Error(body.detail);
  } catch {
    // no-op
  }
  return new Error(`Request failed with status ${response.status}`);
}

export async function getJson<T>(path: string, query?: Query): Promise<T> {
  const response = await fetch(withQuery(path, query));
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}

export async function deleteJson(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
  });
  if (!response.ok) throw await parseError(response);
}

export async function getBlob(path: string, query?: Query): Promise<Blob> {
  const response = await fetch(withQuery(path, query));
  if (!response.ok) throw await parseError(response);
  return response.blob();
}

export async function postMultipart<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<T>;
}
