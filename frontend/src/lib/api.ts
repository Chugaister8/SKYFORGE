import { API_URL } from "@/lib/constants";

interface ApiOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(rest.headers as Record<string, string> ?? {}),
  };
  const res = await fetch(`${API_URL}/api${path}`, { ...rest, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(error.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  get:  <T>(path: string, token?: string) =>
    apiFetch<T>(path, { method: "GET", token }),
  post: <T>(path: string, body: unknown, token?: string) =>
    apiFetch<T>(path, { method: "POST", body: JSON.stringify(body), token }),
};
