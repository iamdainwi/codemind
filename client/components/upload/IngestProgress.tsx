"use client";

import type { Repo } from "@/types/api";

interface IngestProgressProps {
  status: Repo["status"];
  chunkCountAst?: number;
  chunkCountFixed?: number;
}

export function IngestProgress({
  status,
  chunkCountAst,
  chunkCountFixed,
}: IngestProgressProps) {
  const steps = [
    { label: "Archive Unpack", done: status !== "pending" },
    {
      label: "Dual Chunking (AST + Fixed)",
      done: status === "ready",
      active: status === "indexing",
    },
    {
      label: "ChromaDB Embeddings",
      done: status === "ready",
      active: status === "indexing",
    },
  ];

  return (
    <div className="w-full bg-card/40 border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">Ingest Pipeline Status</span>
        <span
          className={`px-2 py-0.5 rounded-full font-medium capitalize ${
            status === "ready"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : status === "indexing"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : status === "error"
              ? "bg-red-500/15 text-red-400 border border-red-500/30"
              : "bg-blue-500/15 text-blue-400 border border-blue-500/30"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`p-2.5 rounded-lg border text-xs text-center transition-all ${
              step.done
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : step.active
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300 animate-pulse"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            }`}
          >
            <div className="font-semibold mb-0.5">Step {idx + 1}</div>
            <div className="text-[11px] truncate">{step.label}</div>
          </div>
        ))}
      </div>

      {status === "ready" && chunkCountAst !== undefined && chunkCountFixed !== undefined && (
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span>
            AST Chunks: <strong className="text-foreground">{chunkCountAst}</strong>
          </span>
          <span>
            Fixed Chunks: <strong className="text-foreground">{chunkCountFixed}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
