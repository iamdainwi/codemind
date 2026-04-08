"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  IconBrandGithub,
  IconCheck,
  IconChevronRight,
  IconGitBranch,
  IconLock,
  IconLoader2,
  IconSearch,
  IconWorld,
  IconX,
} from "@tabler/icons-react"
import { getAuthHeaders } from "@/lib/auth"

interface Repo {
  id: number
  full_name: string
  name: string
  description: string
  private: boolean
  language: string
  updated_at: string
  default_branch: string
  size: number
}

interface GitHubRepoModalProps {
  onClose: () => void
  onIngested: () => void
}

type Phase = "list" | "confirm" | "ingesting" | "done" | "error"

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatSize(kb: number): string {
  if (kb < 1000) return `${kb} KB`
  return `${(kb / 1000).toFixed(1)} MB`
}

export default function GitHubRepoModal({ onClose, onIngested }: GitHubRepoModalProps) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<Repo | null>(null)
  const [phase, setPhase] = useState<Phase>("list")
  const [ingestResult, setIngestResult] = useState<{ files: number; chunks: number } | null>(null)
  const [ingestError, setIngestError] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)

  // Fetch repo list on open
  useEffect(() => {
    let cancelled = false

    async function fetchRepos() {
      try {
        const res = await fetch("/api/github/repos", {
          headers: { ...getAuthHeaders() },
        })
        const json = await res.json()
        if (cancelled) return
        if (json.success) {
          setRepos(json.data.repos)
        } else {
          setFetchError(json.error || "Failed to load repositories")
        }
      } catch (e) {
        if (!cancelled) setFetchError(String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRepos()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!loading) searchRef.current?.focus()
  }, [loading])

  const filteredRepos = repos.filter((r) => {
    const q = query.toLowerCase()
    return (
      r.full_name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.language.toLowerCase().includes(q)
    )
  })

  const handleSelect = useCallback((repo: Repo) => {
    setSelected(repo)
    setPhase("confirm")
  }, [])

  const handleIngest = useCallback(async () => {
    if (!selected) return
    setPhase("ingesting")
    setIngestError("")

    try {
      const res = await fetch("/api/github/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          full_name: selected.full_name,
          branch: selected.default_branch,
        }),
      })
      const json = await res.json()

      if (json.success) {
        setIngestResult({
          files: json.data.files_indexed,
          chunks: json.data.chunks_stored,
        })
        setPhase("done")
        onIngested()
      } else {
        setIngestError(json.error || "Ingestion failed")
        setPhase("error")
      }
    } catch (e) {
      setIngestError(String(e))
      setPhase("error")
    }
  }, [selected, onIngested])

  // Close on backdrop click
  const handleBackdrop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && phase !== "ingesting") onClose()
    },
    [onClose, phase]
  )

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "ingesting") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose, phase])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="flex w-full max-w-xl flex-col rounded-xl border border-cm-border bg-cm-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-cm-border px-4 py-3">
          <IconBrandGithub size={18} className="shrink-0 text-cm-text" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-cm-text">Import from GitHub</h2>
            <p className="text-[10px] text-cm-text-muted">
              {phase === "list" || phase === "confirm"
                ? `${repos.length} repositories available`
                : phase === "ingesting"
                  ? `Fetching ${selected?.full_name}…`
                  : phase === "done"
                    ? "Import complete"
                    : "Import failed"}
            </p>
          </div>
          {phase !== "ingesting" && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-cm-text-muted hover:bg-cm-card hover:text-cm-text"
            >
              <IconX size={14} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex min-h-[320px] flex-col">
          {/* Loading repos */}
          {loading && (
            <div className="flex flex-1 items-center justify-center gap-2 py-16 text-cm-text-muted">
              <IconLoader2 size={18} className="animate-spin text-cm-accent" />
              <span className="text-sm">Loading repositories…</span>
            </div>
          )}

          {/* Fetch error */}
          {!loading && fetchError && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <p className="text-sm text-cm-red">{fetchError}</p>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {/* Repo list */}
          {!loading && !fetchError && phase === "list" && (
            <>
              {/* Search */}
              <div className="border-b border-cm-border px-3 py-2">
                <div className="flex items-center gap-2 rounded-lg border border-cm-border bg-cm-card px-3 py-1.5">
                  <IconSearch size={13} className="shrink-0 text-cm-text-muted" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter repositories…"
                    className="flex-1 bg-transparent text-xs text-cm-text placeholder:text-cm-text-muted focus:outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-cm-text-muted hover:text-cm-text">
                      <IconX size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <ScrollArea className=" h-72">
                {filteredRepos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-cm-text-muted">No repositories match "{query}"</p>
                  </div>
                ) : (
                  <div className="divide-y divide-cm-border">
                    {filteredRepos.map((repo) => (
                      <button
                        key={repo.id}
                        onClick={() => handleSelect(repo)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-cm-card"
                      >
                        <div className="mt-0.5 shrink-0 text-cm-text-muted">
                          {repo.private ? <IconLock size={13} /> : <IconWorld size={13} />}
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-cm-text truncate">
                              {repo.full_name}
                            </span>
                            {repo.private && (
                              <Badge
                                variant="secondary"
                                className="h-4 shrink-0 px-1.5 text-[9px] bg-cm-card text-cm-text-muted"
                              >
                                private
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="truncate text-[11px] text-cm-text-muted">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5">
                            {repo.language && (
                              <span className="text-[10px] text-cm-text-muted">{repo.language}</span>
                            )}
                            <span className="text-[10px] text-cm-text-muted">
                              {formatSize(repo.size)}
                            </span>
                            <span className="text-[10px] text-cm-text-muted">
                              {relativeTime(repo.updated_at)}
                            </span>
                          </div>
                        </div>
                        <IconChevronRight size={13} className="mt-0.5 shrink-0 text-cm-text-muted" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          {/* Confirm */}
          {phase === "confirm" && selected && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cm-border bg-cm-card">
                <IconBrandGithub size={22} className="text-cm-text" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cm-text">{selected.full_name}</p>
                {selected.description && (
                  <p className="mt-1 text-xs text-cm-text-muted">{selected.description}</p>
                )}
                <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-cm-text-muted">
                  <span className="flex items-center gap-1">
                    <IconGitBranch size={11} /> {selected.default_branch}
                  </span>
                  <span>{formatSize(selected.size)}</span>
                  {selected.language && <span>{selected.language}</span>}
                </div>
              </div>
              <p className="text-xs text-cm-text-muted">
                All supported source files will be indexed into your knowledge base.
                Large files (&gt;500 KB) are skipped automatically.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cm-text-muted"
                  onClick={() => setPhase("list")}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  className="bg-cm-accent hover:bg-cm-accent-dim"
                  onClick={handleIngest}
                >
                  Import repository
                </Button>
              </div>
            </div>
          )}

          {/* Ingesting */}
          {phase === "ingesting" && selected && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
              <IconLoader2 size={32} className="animate-spin text-cm-accent" />
              <div>
                <p className="text-sm font-semibold text-cm-text">Importing {selected.full_name}</p>
                <p className="mt-1 text-xs text-cm-text-muted">
                  Fetching files from GitHub and building your knowledge base…
                </p>
                <p className="mt-1 text-[10px] text-cm-text-muted">This may take a minute for large repos.</p>
              </div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && ingestResult && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cm-green/15">
                <IconCheck size={22} className="text-cm-green" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cm-text">Import complete</p>
                <p className="mt-1 text-xs text-cm-text-muted">
                  {ingestResult.files} files indexed · {ingestResult.chunks} chunks stored
                </p>
              </div>
              <Button
                size="sm"
                className="bg-cm-accent hover:bg-cm-accent-dim"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cm-red/15">
                <IconX size={22} className="text-cm-red" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cm-text">Import failed</p>
                {ingestError && (
                  <p className="mt-1 text-xs text-cm-text-muted">{ingestError}</p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" size="sm" onClick={() => setPhase("confirm")}>
                  Retry
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
