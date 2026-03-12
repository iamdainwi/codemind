"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { IconFile, IconLoader2, IconArrowRight } from "@tabler/icons-react";
import { getAuthHeaders } from "@/lib/auth";

interface FileCardProps {
  filePath: string;
  language: string;
}

interface Recommendation {
  file_path: string;
  language: string;
  score: number;
}

const LANG_COLORS: Record<string, string> = {
  python: "bg-yellow-500/20 text-yellow-400",
  javascript: "bg-yellow-400/20 text-yellow-300",
  typescript: "bg-blue-500/20 text-blue-400",
  tsx: "bg-blue-500/20 text-blue-400",
  go: "bg-cyan-500/20 text-cyan-400",
  java: "bg-orange-500/20 text-orange-400",
  cpp: "bg-purple-500/20 text-purple-400",
  rust: "bg-orange-600/20 text-orange-400",
  markdown: "bg-gray-400/20 text-gray-300",
};

function langColor(lang: string) {
  return LANG_COLORS[lang] || "bg-gray-500/20 text-gray-400";
}

export default function FileCard({ filePath, language }: FileCardProps) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filePath) return;

    setLoading(true);
    fetch(
      `/api/recommend?file_path=${encodeURIComponent(filePath)}&top_k=4`,
      { headers: { ...getAuthHeaders() } },
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.recommendations) {
          setRecs(json.data.recommendations);
        } else {
          setRecs([]);
        }
      })
      .catch(() => setRecs([]))
      .finally(() => setLoading(false));
  }, [filePath]);

  return (
    <div className="rounded-lg border border-cm-border bg-cm-card p-4">
      {/* Selected file header */}
      <div className="flex items-center gap-2">
        <IconFile size={16} className="text-cm-accent" />
        <span className="flex-1 truncate text-sm font-medium text-cm-text">
          {filePath}
        </span>
        <Badge
          variant="secondary"
          className={`h-5 px-2 text-[10px] font-normal ${langColor(language)}`}
        >
          {language}
        </Badge>
      </div>

      {/* Recommendations */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
          Similar Files
        </p>

        {loading && (
          <div className="flex items-center gap-2 py-4">
            <IconLoader2 size={14} className="animate-spin text-cm-accent" />
            <span className="text-xs text-cm-text-muted">
              Finding similar files...
            </span>
          </div>
        )}

        {!loading && recs.length === 0 && (
          <p className="py-3 text-xs text-cm-text-muted">
            No similar files found
          </p>
        )}

        {!loading && recs.length > 0 && (
          <div className="space-y-1.5">
            {recs.map((r) => (
              <div
                key={r.file_path}
                className="flex items-center gap-2 rounded-md bg-cm-bg px-3 py-2 transition-colors hover:bg-cm-card-hover"
              >
                <IconArrowRight size={12} className="text-cm-accent" />
                <span className="flex-1 truncate text-xs text-cm-text-secondary">
                  {r.file_path}
                </span>
                <Badge
                  variant="secondary"
                  className={`h-4 px-1.5 text-[9px] font-normal ${langColor(r.language)}`}
                >
                  {r.language}
                </Badge>
                <span className="text-[10px] font-mono text-cm-accent">
                  {(r.score * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
