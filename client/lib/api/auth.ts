/**
 * lib/api/auth.ts
 * Typed API functions for authentication endpoints.
 */
import { apiFetch } from "./client";
import type { User } from "@/types/api";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function register(username: string, password: string) {
  return apiFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function login(username: string, password: string) {
  return apiFetch<User>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch<Record<string, never>>("/api/v1/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch<User>("/api/v1/auth/me");
}
