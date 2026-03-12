"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconSearch,
  IconLoader2,
  IconFile,
  IconCode,
} from "@tabler/icons-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAuthHeaders } from "@/lib/auth";

interface SearchResult {
  text: string;
  file_path: string;
  language: string;
  chunk_index: number;
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

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || isSearching) return;

    setIsSearching(true);
    setHasSearched(true);
    setExpandedIdx(null);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&top_k=8`,
        { headers: { ...getAuthHeaders() } },
      );
      const json = await res.json();

      if (json.success && json.data?.results) {
        setResults(json.data.results);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    }

    setIsSearching(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search input */}
      <div className="border-b border-cm-border p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-cm-border bg-cm-card px-3">
              <IconSearch size={16} className="text-cm-text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Describe what you are looking for, e.g. authentication handler"
                className="flex-1 bg-transparent py-2.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:outline-none"
              />
            </div>
            <Button
              className="bg-cm-accent px-4 hover:bg-cm-accent-dim"
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {!hasSearched && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/15">
                <IconSearch size={24} className="text-cm-accent" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-cm-text">
                Semantic Search
              </h3>
              <p className="mt-1.5 max-w-sm text-xs text-cm-text-muted">
                Describe what you&apos;re looking for in plain English. CodeMind searches
                by meaning, not just keywords.
              </p>
            </div>
          )}

          {hasSearched && results.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconFile size={32} className="text-cm-text-muted/30" />
              <p className="mt-3 text-xs text-cm-text-muted">
                No matching code found
              </p>
            </div>
          )}

          {isSearching && (
            <div className="flex flex-col items-center justify-center py-16">
              <IconLoader2 size={24} className="animate-spin text-cm-accent" />
              <p className="mt-3 text-xs text-cm-text-muted">
                Searching codebase...
              </p>
            </div>
          )}

          {results.map((r, i) => (
            <div
              key={`${r.file_path}-${r.chunk_index}`}
              className="group overflow-hidden rounded-lg border border-cm-border bg-cm-card transition-colors hover:border-cm-text-muted/30"
            >
              {/* Result header */}
              <button
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-cm-bg text-[10px] font-bold text-cm-text-muted">
                  {i + 1}
                </div>
                <IconCode size={14} className="text-cm-text-muted" />
                <span className="flex-1 truncate text-xs text-cm-text">
                  {r.file_path}
                  <span className="ml-1 text-cm-text-muted">
                    :chunk_{r.chunk_index}
                  </span>
                </span>
                <Badge
                  variant="secondary"
                  className={`h-4 px-1.5 text-[9px] font-normal ${langColor(r.language)}`}
                >
                  {r.language}
                </Badge>
                <span className="text-[10px] font-mono text-cm-accent">
                  {(r.score * 100).toFixed(1)}%
                </span>
              </button>

              {/* Code preview */}
              {expandedIdx === i && (
                <div className="border-t border-cm-border">
                  <SyntaxHighlighter
                    style={oneDark}
                    language={r.language === "tsx" ? "tsx" : r.language}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: "12px 16px",
                      background: "#0d0d0d",
                      fontSize: "11px",
                      lineHeight: "1.6",
                    }}
                    showLineNumbers
                    lineNumberStyle={{ color: "#3f3f46", fontSize: "10px" }}
                  >
                    {r.text}
                  </SyntaxHighlighter>
                </div>
              )}

              {/* Collapsed preview */}
              {expandedIdx !== i && (
                <div className="border-t border-cm-border bg-cm-bg/50 px-4 py-2">
                  <p className="truncate text-[11px] text-cm-text-muted font-mono">
                    {r.text.split("\n").slice(0, 2).join(" ").substring(0, 120)}...
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
