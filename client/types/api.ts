/**
 * types/api.ts
 * Shared TypeScript interfaces matching the server's API contract.
 * Every field here mirrors the FastAPI response envelope exactly.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface User {
  user_id: string;
  username: string;
}

export interface Repo {
  repo_id: string;
  name: string;
  status: "pending" | "indexing" | "ready" | "error";
  file_count: number;
  chunk_count_ast: number;
  chunk_count_fixed: number;
  created_at: string;
}

export interface RepoDetail extends Repo {
  duration_ms_ast: number;
  duration_ms_fixed: number;
  skipped_files: number;
  error_message: string | null;
}

export interface ChatMessage {
  role: "human" | "assistant";
  content: string;
}

export interface EvalMetrics {
  precision_at_k: number;
  recall_at_k: number;
  mrr: number;
  rouge_l: number;
  chunk_size_mean: number;
  chunk_size_std: number;
  chunk_size_min: number;
  chunk_size_max: number;
  boundary_accuracy: number;
}

export interface EvalResult {
  run_id: string;
  repo_id: string;
  dataset_id: string;
  status: string;
  ast_metrics: EvalMetrics | null;
  fixed_metrics: EvalMetrics | null;
  completed_at: string | null;
}
