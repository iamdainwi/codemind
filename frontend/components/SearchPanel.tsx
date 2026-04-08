"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconSearch,
  IconLoader2,
  IconFile,
  IconClock,
  IconX,
} from "@tabler/icons-react";
import CodeBlock from "@/components/CodeBlock";
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
  jsx: "bg-blue-400/20 text-blue-300",
  go: "bg-cyan-500/20 text-cyan-400",
  java: "bg-orange-500/20 text-orange-400",
  cpp: "bg-purple-500/20 text-purple-400",
  c: "bg-gray-500/20 text-gray-400",
  rust: "bg-orange-600/20 text-orange-400",
  ruby: "bg-red-500/20 text-red-400",
  php: "bg-indigo-500/20 text-indigo-400",
  markdown: "bg-gray-400/20 text-gray-300",
  json: "bg-green-500/20 text-green-400",
  yaml: "bg-pink-500/20 text-pink-400",
  text: "bg-gray-500/20 text-gray-400",
};

function langColor(lang: string) {
  return LANG_COLORS[lang] || "bg-gray-500/20 text-gray-400";
}

const RECENT_SEARCHES_KEY = "cm_recent_searches";
const MAX_RECENT = 5;
const MIN_QUERY_LEN = 3;

const LANG_FILTERS = [
  "All",
  "Python",
  "TypeScript",
  "JavaScript",
  "Go",
  "Rust",
  "Java",
  "C++",
  "Ruby",
];

function langFilterMatch(result: SearchResult, filter: string): boolean {
  if (filter === "All") return true;
  const map: Record<string, string[]> = {
    Python: ["python"],
    TypeScript: ["typescript", "tsx"],
    JavaScript: ["javascript", "jsx"],
    Go: ["go"],
    Rust: ["rust"],
    Java: ["java"],
    "C++": ["cpp", "c"],
    Ruby: ["ruby"],
  };
  return (map[filter] || []).includes(result.language.toLowerCase());
}

function scoreBarColor(score: number): string {
  if (score >= 0.8) return "bg-cm-green";
  if (score >= 0.5) return "bg-cm-yellow";
  return "bg-cm-text-muted";
}

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(q: string) {
  const existing = getRecentSearches().filter((s) => s !== q);
  const updated = [q, ...existing].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function removeRecentSearch(q: string) {
  const updated = getRecentSearches().filter((s) => s !== q);
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export default function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [langFilter, setLangFilter] = useState("All");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.trim().length < MIN_QUERY_LEN) return;

    setIsSearching(true);
    setHasSearched(true);
    setExpandedIdx(null);

    addRecentSearch(q.trim());
    setRecentSearches(getRecentSearches());

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&top_k=8`,
        { headers: { ...getAuthHeaders() } }
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
  }, []);

  const onQueryChange = (val: string) => {
    setQuery(val);
    setLangFilter("All");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= MIN_QUERY_LEN) {
      debounceRef.current = setTimeout(() => {
        doSearch(val);
      }, 400);
    } else if (val.trim().length === 0) {
      setHasSearched(false);
      setResults([]);
    }
  };

  const handleRecentSearch = (q: string) => {
    setQuery(q);
    doSearch(q);
  };

  const handleRemoveRecent = (q: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeRecentSearch(q);
    setRecentSearches(getRecentSearches());
  };

  const filteredResults = results.filter((r) =>
    langFilterMatch(r, langFilter)
  );

  // Detect available languages in results
  const availableLangs = new Set(results.map((r) => r.language.toLowerCase()));
  const visibleFilters = LANG_FILTERS.filter(
    (f) =>
      f === "All" ||
      (availableLangs.size > 0 &&
        (
          {
            Python: ["python"],
            TypeScript: ["typescript", "tsx"],
            JavaScript: ["javascript", "jsx"],
            Go: ["go"],
            Rust: ["rust"],
            Java: ["java"],
            "C++": ["cpp", "c"],
            Ruby: ["ruby"],
          }[f] || []
        ).some((l) => availableLangs.has(l)))
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search input + lang filter */}
      <div className="border-b border-cm-border p-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-cm-border bg-cm-card px-3 focus-within:border-cm-text-muted/50 transition-colors">
            <IconSearch size={16} className="shrink-0 text-cm-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  doSearch(query);
                }
              }}
              placeholder="Describe what you're looking for (min 3 chars)..."
              className="flex-1 bg-transparent py-2.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:outline-none"
            />
            {isSearching && (
              <IconLoader2 size={14} className="animate-spin text-cm-accent" />
            )}
            {query && !isSearching && (
              <button
                onClick={() => {
                  setQuery("");
                  setHasSearched(false);
                  setResults([]);
                }}
                className="text-cm-text-muted transition-colors hover:text-cm-text"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Language filter chips — show only when results exist */}
          {hasSearched && results.length > 0 && visibleFilters.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => setLangFilter(f)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${
                    langFilter === f
                      ? "border-cm-accent bg-cm-accent/15 text-cm-accent"
                      : "border-cm-border text-cm-text-muted hover:border-cm-text-muted hover:text-cm-text"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <ScrollArea className="h-4/5">
        <div className="mx-auto max-w-3xl space-y-3 p-4">
          {/* Empty state / recent searches */}
          {!hasSearched && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/15">
                <IconSearch size={24} className="text-cm-accent" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-cm-text">
                Semantic Search
              </h3>
              <p className="mt-1.5 max-w-sm text-xs text-cm-text-muted">
                Describe what you&apos;re looking for in plain English. CodeMind
                searches by meaning, not just keywords.
              </p>

              {recentSearches.length > 0 && (
                <div className="mt-8 w-full max-w-sm text-left">
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                    <IconClock size={11} />
                    Recent Searches
                  </p>
                  <div className="space-y-1">
                    {recentSearches.map((s) => (
                      <div
                        key={s}
                        className="group flex items-center gap-2 rounded-md border border-cm-border bg-cm-card px-3 py-2"
                      >
                        <button
                          className="flex-1 text-left text-xs text-cm-text-secondary transition-colors hover:text-cm-text"
                          onClick={() => handleRecentSearch(s)}
                        >
                          {s}
                        </button>
                        <button
                          onClick={(e) => handleRemoveRecent(s, e)}
                          className="text-cm-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-cm-text"
                        >
                          <IconX size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasSearched && filteredResults.length === 0 && !isSearching && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <IconFile size={32} className="text-cm-text-muted/30" />
              <p className="mt-3 text-xs text-cm-text-muted">
                {langFilter !== "All"
                  ? `No ${langFilter} results — try a different language filter`
                  : "No matching code found"}
              </p>
            </div>
          )}

          {/* Result cards */}
          {filteredResults.map((r, i) => {
            const parts = r.file_path.split("/");
            const filename = parts[parts.length - 1];
            const folder =
              parts.length > 1 ? parts.slice(0, -1).join("/") : null;
            const preview = r.text
              .split("\n")
              .slice(0, 2)
              .join(" ")
              .substring(0, 140);
            const isExpanded = expandedIdx === i;

            return (
              <div
                key={`${r.file_path}-${r.chunk_index}`}
                className="overflow-hidden rounded-lg border border-cm-border bg-cm-card transition-colors hover:border-cm-text-muted/30"
              >
                {/* Header row */}
                <button
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  {/* Score bar indicator */}
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <div className="h-8 w-1.5 overflow-hidden rounded-full bg-cm-bg">
                      <div
                        className={`rounded-full ${scoreBarColor(r.score)} transition-all`}
                        style={{ height: `${Math.round(r.score * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {folder && (
                        <span className="truncate text-[10px] text-cm-text-muted">
                          {folder}/
                        </span>
                      )}
                      <span className="text-xs font-medium text-cm-text">
                        {filename}
                      </span>
                      <span className="text-[10px] text-cm-text-muted">
                        :chunk_{r.chunk_index}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant="secondary"
                    className={`h-4 shrink-0 px-1.5 text-[9px] font-normal ${langColor(r.language)}`}
                  >
                    {r.language}
                  </Badge>
                  <span
                    className={`shrink-0 text-[11px] font-mono font-medium ${
                      r.score >= 0.8
                        ? "text-cm-green"
                        : r.score >= 0.5
                          ? "text-cm-yellow"
                          : "text-cm-text-muted"
                    }`}
                  >
                    {(r.score * 100).toFixed(1)}%
                  </span>
                </button>

                {/* 2-line preview when collapsed */}
                {!isExpanded && (
                  <div className="border-t border-cm-border bg-cm-bg/50 px-4 py-2">
                    <p className="truncate font-mono text-[11px] text-cm-text-muted">
                      {preview}
                      {r.text.length > 140 ? "..." : ""}
                    </p>
                  </div>
                )}

                {/* Expanded code view */}
                {isExpanded && (
                  <div className="border-t border-cm-border">
                    <CodeBlock language={r.language} code={r.text} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
