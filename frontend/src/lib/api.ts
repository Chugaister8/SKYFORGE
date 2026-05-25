// In browser: use Next.js proxy (relative /api/...)
// In SSR/build: use absolute URL
const isBrowser = typeof window !== "undefined";
const BASE = isBrowser ? "" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

async function apiFetch<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> ?? {}),
  };
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, { ...rest, headers });
  if (!res.ok) {
    let detail = "Request failed";
    try { const err = await res.json(); detail = err.detail ?? err.message ?? `HTTP ${res.status}`; } catch {}
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string, token?: string) =>
    apiFetch<T>(path, { method: "GET", token }),
  post:   <T>(path: string, body: unknown, token?: string) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body), token }),
  patch:  <T>(path: string, body: unknown, token?: string) =>
    apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body), token }),
  put:    <T>(path: string, body: unknown, token?: string) =>
    apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body), token }),
  delete: <T>(path: string, token?: string) =>
    apiFetch<T>(path, { method: "DELETE", token }),
};
