/**
 * lib/api/client.ts
 * Base fetch wrapper — all API calls go through here.
 * Automatically includes credentials (session cookie) and the base URL.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<{ success: boolean; data: T | null; error: { code: string; message: string } | null }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const json = await res.json();
  return json;
}
