"use client";

import { useState, useEffect, useCallback } from "react";
import { listRepos } from "@/lib/api/repos";
import { listAllEvalResults, triggerEval, getEvalResults } from "@/lib/api/eval";
import type { Repo, EvalResult } from "@/types/api";
import { MetricsChart } from "@/components/eval/MetricsChart";
import { ComparisonTable } from "@/components/eval/ComparisonTable";
import {
  BarChart3,
  Play,
  RefreshCw,
  FolderGit2,
  TrendingUp,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Code2,
  Sparkles,
  BookOpen,
} from "lucide-react";

export default function EvalPage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [results, setResults] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [evalRunning, setEvalRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReposAndInitialData = useCallback(async () => {
    try {
      const repoRes = await listRepos();
      if (repoRes.success && repoRes.data && repoRes.data.length > 0) {
        setRepos(repoRes.data);
        const readyRepo = repoRes.data.find((r) => r.status === "ready") || repoRes.data[0];
        setSelectedRepoId(readyRepo.repo_id);

        // Fetch eval result for this repo
        const evalRes = await getEvalResults(readyRepo.repo_id);
        if (evalRes.success && evalRes.data) {
          setResults(evalRes.data);
        } else {
          // Check if any results in system
          const allRes = await listAllEvalResults();
          if (allRes.success && allRes.data && allRes.data.length > 0) {
            setResults(allRes.data[0]);
          }
        }
      }
    } catch {
      setError("Failed to initialize evaluation page.");
    }
  }, []);

  useEffect(() => {
    fetchReposAndInitialData();
  }, [fetchReposAndInitialData]);

  const handleSelectRepo = async (id: string) => {
    setSelectedRepoId(id);
    setLoading(true);
    setError(null);
    try {
      const res = await getEvalResults(id);
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setResults(null);
      }
    } catch {
      setError("Failed to fetch results for selected repository.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunEval = async () => {
    if (!selectedRepoId || evalRunning) return;
    setEvalRunning(true);
    setError(null);

    try {
      const res = await triggerEval(selectedRepoId);
      if (!res.success) {
        setError(res.error?.message ?? "Failed to trigger evaluation run.");
        setEvalRunning(false);
        return;
      }

      // Poll until finished
      const timer = setInterval(async () => {
        try {
          const pollRes = await getEvalResults(selectedRepoId);
          if (pollRes.success && pollRes.data) {
            setResults(pollRes.data);
            if (pollRes.data.status === "completed" || pollRes.data.status === "failed") {
              clearInterval(timer);
              setEvalRunning(false);
            }
          }
        } catch {
          // Keep polling
        }
      }, 3000);
    } catch {
      setError("Network error while running evaluation.");
      setEvalRunning(false);
    }
  };

  const pAt5Ast = results?.ast_metrics?.precision_at_k;
  const pAt5Fixed = results?.fixed_metrics?.precision_at_k;
  const pAt5Delta = pAt5Ast != null && pAt5Fixed != null ? (pAt5Ast - pAt5Fixed) * 100 : null;

  const recallAst = results?.ast_metrics?.recall_at_k;
  const recallFixed = results?.fixed_metrics?.recall_at_k;
  const recallDelta = recallAst != null && recallFixed != null ? (recallAst - recallFixed) * 100 : null;

  const mrrAst = results?.ast_metrics?.mrr;
  const mrrFixed = results?.fixed_metrics?.mrr;
  const mrrDelta = mrrAst != null && mrrFixed != null ? mrrAst - mrrFixed : null;

  const boundaryAcc = results?.ast_metrics?.boundary_accuracy;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Evaluation & Benchmark Dashboard</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
              Research Analytics
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Empirical validation of AST syntax chunking against traditional fixed-window baselines across standard codebase retrieval tasks.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedRepoId}
              onChange={(e) => handleSelectRepo(e.target.value)}
              disabled={repos.length === 0 || evalRunning}
              className="px-3.5 py-2 pl-9 rounded-lg bg-card border border-border/80 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none pr-8 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {repos.length === 0 ? (
                <option value="">No repositories indexed</option>
              ) : (
                repos.map((r) => (
                  <option key={r.repo_id} value={r.repo_id}>
                    {r.name} ({r.status})
                  </option>
                ))
              )}
            </select>
            <FolderGit2 className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            id="run-eval-btn"
            onClick={handleRunEval}
            disabled={!selectedRepoId || evalRunning || loading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-500/20 flex items-center gap-2"
          >
            {evalRunning ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Running Benchmark…</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Run Evaluation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {/* KPI Bento Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Precision Card */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">AST Precision@5</span>
            <Cpu className="size-3.5 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-400">
            {pAt5Ast != null ? `${(pAt5Ast * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Fixed: {pAt5Fixed != null ? `${(pAt5Fixed * 100).toFixed(1)}%` : "—"}</span>
            {pAt5Delta != null && (
              <span
                className={`px-1.5 py-0.5 rounded-sm ${
                  pAt5Delta >= 0
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {pAt5Delta >= 0 ? `+${pAt5Delta.toFixed(1)}%` : `${pAt5Delta.toFixed(1)}%`}
              </span>
            )}
          </div>
        </div>

        {/* Recall Card */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">AST Recall@5</span>
            <Layers className="size-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {recallAst != null ? `${(recallAst * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Fixed: {recallFixed != null ? `${(recallFixed * 100).toFixed(1)}%` : "—"}</span>
            {recallDelta != null && (
              <span
                className={`px-1.5 py-0.5 rounded-sm ${
                  recallDelta >= 0
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {recallDelta >= 0 ? `+${recallDelta.toFixed(1)}%` : `${recallDelta.toFixed(1)}%`}
              </span>
            )}
          </div>
        </div>

        {/* MRR Card */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Mean Recip. Rank</span>
            <TrendingUp className="size-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {mrrAst != null ? mrrAst.toFixed(3) : "—"}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Fixed: {mrrFixed != null ? mrrFixed.toFixed(3) : "—"}</span>
            {mrrDelta != null && (
              <span
                className={`px-1.5 py-0.5 rounded-sm ${
                  mrrDelta >= 0
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                    : "text-red-400 bg-red-500/10"
                }`}
              >
                {mrrDelta >= 0 ? `+${mrrDelta.toFixed(3)}` : `${mrrDelta.toFixed(3)}`}
              </span>
            )}
          </div>
        </div>

        {/* Boundary Card */}
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span className="font-medium">Boundary Accuracy</span>
            <ShieldCheck className="size-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {boundaryAcc != null ? `${(boundaryAcc * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Syntax Integrity</span>
            <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm border border-emerald-500/20">
              Zero ruptures
            </span>
          </div>
        </div>
      </div>

      {/* Visual Graphs & Comparison Table */}
      <div className="space-y-6">
        <MetricsChart
          astMetrics={results?.ast_metrics ?? null}
          fixedMetrics={results?.fixed_metrics ?? null}
        />

        <ComparisonTable
          astMetrics={results?.ast_metrics ?? null}
          fixedMetrics={results?.fixed_metrics ?? null}
        />
      </div>

      {/* Research Methodology Callout Card */}
      <div className="p-6 rounded-2xl border border-border/70 bg-card/30 backdrop-blur-sm space-y-4 shadow-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-violet-400" />
          <h4 className="font-semibold text-foreground text-sm">
            Research Framework & Empirical Methodology
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-xs bg-violet-500 inline-block" />
              <span>Tree-Sitter AST Chunking (Proposed)</span>
            </div>
            <p className="leading-relaxed">
              Parses source code into a concrete syntax tree, identifying top-level and nested declarations (classes, methods, functions). Chunks strictly maintain syntactic integrity and are enriched with qualified hierarchical identifier paths (e.g. <code className="text-violet-400 font-mono">ClassName.method_name</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-xs bg-zinc-500 inline-block" />
              <span>Fixed-Window Baseline (Conventional)</span>
            </div>
            <p className="leading-relaxed">
              Divides code indiscriminately into fixed character or token windows (e.g., 500 characters with 100 character overlap). Arbitrarily splits functions, class definitions, and variable scopes, resulting in lost context and degraded semantic embeddings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
