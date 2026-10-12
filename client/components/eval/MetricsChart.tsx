"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { EvalMetrics } from "@/types/api";
import { BarChart3, Info } from "lucide-react";

interface MetricsChartProps {
  astMetrics: EvalMetrics | null;
  fixedMetrics: EvalMetrics | null;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  dataKey: string;
  fill?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const astVal = payload.find((p) => p.dataKey === "AST")?.value ?? 0;
  const fixedVal = payload.find((p) => p.dataKey === "Fixed")?.value ?? 0;
  const delta = astVal - fixedVal;

  return (
    <div className="p-3 rounded-xl border border-border/80 bg-zinc-950/95 backdrop-blur-md shadow-2xl text-xs space-y-2 min-w-48">
      <div className="font-semibold text-foreground border-b border-border/60 pb-1.5 flex items-center justify-between">
        <span>{label}</span>
        {delta !== 0 && (
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm ${
              delta > 0
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {delta > 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
          </span>
        )}
      </div>

      <div className="space-y-1 font-mono text-[11px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-violet-300">
            <span className="size-2 rounded-xs bg-violet-500 inline-block" />
            AST Chunker:
          </span>
          <span className="font-semibold text-foreground">{astVal.toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="size-2 rounded-xs bg-zinc-600 inline-block" />
            Fixed-Window:
          </span>
          <span className="text-muted-foreground">{fixedVal.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export function MetricsChart({ astMetrics, fixedMetrics }: MetricsChartProps) {
  if (!astMetrics || !fixedMetrics) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-sm text-muted-foreground border border-border/70 rounded-2xl bg-card/30 p-8 space-y-2">
        <BarChart3 className="size-8 text-muted-foreground/40" />
        <p className="font-medium text-foreground">No benchmark dataset visualised</p>
        <p className="text-xs text-muted-foreground">
          Select an indexed repository and trigger an evaluation run to compute comparison bars.
        </p>
      </div>
    );
  }

  const data = [
    {
      metric: "Precision@5",
      AST: Number((astMetrics.precision_at_k * 100).toFixed(1)),
      Fixed: Number((fixedMetrics.precision_at_k * 100).toFixed(1)),
    },
    {
      metric: "Recall@5",
      AST: Number((astMetrics.recall_at_k * 100).toFixed(1)),
      Fixed: Number((fixedMetrics.recall_at_k * 100).toFixed(1)),
    },
    {
      metric: "MRR",
      AST: Number((astMetrics.mrr * 100).toFixed(1)),
      Fixed: Number((fixedMetrics.mrr * 100).toFixed(1)),
    },
    {
      metric: "ROUGE-L",
      AST: Number((astMetrics.rouge_l * 100).toFixed(1)),
      Fixed: Number((fixedMetrics.rouge_l * 100).toFixed(1)),
    },
    {
      metric: "Boundary Acc.",
      AST: Number((astMetrics.boundary_accuracy * 100).toFixed(1)),
      Fixed: Number((fixedMetrics.boundary_accuracy * 100).toFixed(1)),
    },
  ];

  return (
    <div className="w-full p-6 border border-border/80 rounded-2xl bg-card/40 backdrop-blur-sm space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Retrieval & Generation Comparative Performance (%)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empirical benchmark comparing AST semantic units against fixed character windows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <Info className="size-3.5 text-violet-400" />
          <span>Higher is better · Scale 0–100%</span>
        </div>
      </div>

      <div className="h-80 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 16, left: -16, bottom: 4 }}
            barGap={8}
          >
            <defs>
              <linearGradient id="astGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id="fixedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#52525b" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#3f3f46" stopOpacity={0.6} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#27272a"
              vertical={false}
              opacity={0.5}
            />

            <XAxis
              dataKey="metric"
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              dy={6}
            />

            <YAxis
              stroke="#71717a"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: "#27272a" }}
              domain={[0, 100]}
              unit="%"
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingBottom: "12px" }}
              formatter={(val) =>
                val === "AST" ? (
                  <span className="text-violet-300 font-medium">AST Chunker (Proposed)</span>
                ) : (
                  <span className="text-zinc-400">Fixed-Window (Baseline)</span>
                )
              }
            />

            <Bar
              dataKey="AST"
              fill="url(#astGradient)"
              radius={[6, 6, 0, 0]}
              name="AST"
              maxBarSize={44}
            />
            <Bar
              dataKey="Fixed"
              fill="url(#fixedGradient)"
              radius={[6, 6, 0, 0]}
              name="Fixed"
              maxBarSize={44}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
