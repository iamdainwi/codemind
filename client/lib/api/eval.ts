/**
 * lib/api/eval.ts
 * Typed API functions for evaluation endpoints.
 */
import { apiFetch } from "./client";
import type { EvalResult } from "@/types/api";

export async function triggerEval(repoId: string, datasetId = "python_oss_sample") {
  return apiFetch<{ run_id: string; status: string }>(`/api/v1/eval/${repoId}/run`, {
    method: "POST",
    body: JSON.stringify({ dataset_id: datasetId }),
  });
}

export async function getEvalResults(repoId: string) {
  return apiFetch<EvalResult>(`/api/v1/eval/${repoId}/results`);
}

export async function listAllEvalResults() {
  return apiFetch<EvalResult[]>("/api/v1/eval/results");
}
