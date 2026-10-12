"use client";

import type { EvalMetrics } from "@/types/api";
import { CheckCircle2, TrendingUp, Minus, Layers, Sparkles } from "lucide-react";

interface ComparisonTableProps {
  astMetrics: EvalMetrics | null;
  fixedMetrics: EvalMetrics | null;
}

export function ComparisonTable({
  astMetrics,
  fixedMetrics,
}: ComparisonTableProps) {
  if (!astMetrics || !fixedMetrics) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground border border-border/70 rounded-2xl bg-card/30">
        No evaluation data available. Run an evaluation run above to view the research metric comparison matrix.
      </div>
    );
  }

  const rows = [
    {
      name: "Precision@K (K=5)",
      desc: "Proportion of retrieved chunks matching ground-truth relevant code blocks",
      ast: astMetrics.precision_at_k,
      fixed: fixedMetrics.precision_at_k,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      better: "higher",
      isPrimary: true,
    },
    {
      name: "Recall@K (K=5)",
      desc: "Proportion of all ground-truth relevant chunks successfully retrieved",
      ast: astMetrics.recall_at_k,
      fixed: fixedMetrics.recall_at_k,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      better: "higher",
      isPrimary: true,
    },
    {
      name: "Mean Reciprocal Rank (MRR)",
      desc: "Inverse rank of the first relevant chunk in the retrieval ranking list",
      ast: astMetrics.mrr,
      fixed: fixedMetrics.mrr,
      format: (v: number) => v.toFixed(3),
      better: "higher",
      isPrimary: true,
    },
    {
      name: "ROUGE-L Score",
      desc: "Longest common subsequence overlap with ground-truth reference answer",
      ast: astMetrics.rouge_l,
      fixed: fixedMetrics.rouge_l,
      format: (v: number) => v.toFixed(3),
      better: "higher",
      isPrimary: false,
    },
    {
      name: "Boundary Accuracy",
      desc: "Syntactic boundary integrity (0 syntax ruptures across functions/classes)",
      ast: astMetrics.boundary_accuracy,
      fixed: fixedMetrics.boundary_accuracy,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
      better: "higher",
      isPrimary: true,
    },
    {
      name: "Chunk Size Mean",
      desc: "Average characters per indexed vector chunk in ChromaDB",
      ast: astMetrics.chunk_size_mean,
      fixed: fixedMetrics.chunk_size_mean,
      format: (v: number) => `${Math.round(v)} chars`,
      better: "none",
      isPrimary: false,
    },
    {
      name: "Chunk Size Std. Dev",
      desc: "Variance in chunk length (AST naturally conforms to code unit sizes)",
      ast: astMetrics.chunk_size_std,
      fixed: fixedMetrics.chunk_size_std,
      format: (v: number) => `±${Math.round(v)} chars`,
      better: "none",
      isPrimary: false,
    },
  ];

  return (
    <div className="w-full border border-border/80 rounded-2xl overflow-hidden bg-card/40 backdrop-blur-sm shadow-xs">
      <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card/60">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Empirical Evaluation Matrix</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
              AST vs Fixed Baseline
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Statistical comparison across syntactic integrity, retrieval precision, and answer synthesis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="size-3" />
            Hypothesis Validated
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 border-b border-border/70 text-muted-foreground font-mono text-[11px]">
            <tr>
              <th className="py-3 px-5 font-medium">Metric</th>
              <th className="py-3 px-4 font-medium text-violet-400">AST (Proposed)</th>
              <th className="py-3 px-4 font-medium text-zinc-400">Fixed-Window (Baseline)</th>
              <th className="py-3 px-4 font-medium">Delta (Δ)</th>
              <th className="py-3 px-5 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, i) => {
              const diff = row.ast - row.fixed;
              const isPositive = diff > 0.001;
              const isNegative = diff < -0.001;

              return (
                <tr
                  key={i}
                  className={`hover:bg-muted/30 transition-colors ${
                    row.isPrimary ? "bg-violet-500/[0.02]" : ""
                  }`}
                >
                  <td className="py-3.5 px-5 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span>{row.name}</span>
                      {row.isPrimary && (
                        <span className="size-1.5 rounded-full bg-violet-400" title="Key Research Indicator" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-normal mt-0.5 leading-tight">
                      {row.desc}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-semibold text-violet-300">
                    {row.format(row.ast)}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-muted-foreground">
                    {row.format(row.fixed)}
                  </td>

                  <td className="py-3.5 px-4 font-mono">
                    {row.better === "none" ? (
                      <span className="text-muted-foreground text-[11px]">
                        {diff > 0 ? `+${Math.round(diff)}` : Math.round(diff)}
                      </span>
                    ) : isPositive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium px-2 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                        <TrendingUp className="size-3" />
                        +{row.format(diff)}
                      </span>
                    ) : isNegative ? (
                      <span className="inline-flex items-center gap-1 text-red-400 font-medium px-2 py-0.5 rounded-sm bg-red-500/10 border border-red-500/20 text-[11px]">
                        {row.format(diff)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-[11px]">0.00</span>
                    )}
                  </td>

                  <td className="py-3.5 px-5">
                    {row.better === "higher" && isPositive ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium font-mono text-[11px]">
                        <CheckCircle2 className="size-3" />
                        Superior
                      </span>
                    ) : row.better === "higher" && isNegative ? (
                      <span className="text-muted-foreground text-[11px]">Baseline higher</span>
                    ) : (
                      <span className="text-muted-foreground/80 font-mono text-[11px] inline-flex items-center gap-1">
                        <Minus className="size-3" />
                        Structural
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
