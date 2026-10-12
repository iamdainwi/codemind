/**
 * lib/api/repos.ts
 * Typed API functions for repository endpoints.
 */
import { apiFetch } from "./client";
import type { Repo, RepoDetail } from "@/types/api";

export async function uploadRepo(file: File) {
  const form = new FormData();
  form.append("zip_file", file);
  const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const res = await fetch(`${BASE}/api/v1/repos/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
    // No Content-Type header — browser sets it with boundary for multipart
  });
  return res.json();
}

export async function listRepos() {
  return apiFetch<Repo[]>("/api/v1/repos");
}

export async function getRepo(repoId: string) {
  return apiFetch<RepoDetail>(`/api/v1/repos/${repoId}`);
}

export async function deleteRepo(repoId: string) {
  return apiFetch<Record<string, never>>(`/api/v1/repos/${repoId}`, {
    method: "DELETE",
  });
}
