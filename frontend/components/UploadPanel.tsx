"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  IconBrandGithub,
  IconCheck,
  IconFile,
  IconFolderOpen,
  IconLoader2,
  IconUpload,
  IconX,
} from "@tabler/icons-react"
import { getAuthHeaders } from "@/lib/auth"
import GitHubRepoModal from "@/components/GitHubRepoModal"

interface IndexedFile {
  file_path: string
  language: string
}

interface UploadPanelProps {
  files: IndexedFile[]
  onFilesChange: () => void
  onFileSelect: (file: IndexedFile) => void
  selectedFile: string | null
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
}

function langColor(lang: string) {
  return LANG_COLORS[lang] || "bg-gray-500/20 text-gray-400"
}

type UploadStatus = "idle" | "uploading" | "done" | "error"

interface FileUploadState {
  name: string
  status: UploadStatus
  chunks?: number
  error?: string
}

interface GitHubStatus {
  connected: boolean
  username: string | null
}

export default function UploadPanel({
  files,
  onFilesChange,
  onFileSelect,
  selectedFile,
}: UploadPanelProps) {
  const [uploads, setUploads] = useState<FileUploadState[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [githubStatus, setGithubStatus] = useState<GitHubStatus>({ connected: false, username: null })
  const [githubLoading, setGithubLoading] = useState(false)
  const [showRepoModal, setShowRepoModal] = useState(false)
  const [githubBanner, setGithubBanner] = useState(false)

  // Fetch GitHub connection status on mount
  useEffect(() => {
    async function fetchGithubStatus() {
      try {
        const res = await fetch("/api/github/status", {
          headers: { ...getAuthHeaders() },
        })
        const json = await res.json()
        if (json.success) setGithubStatus(json.data)
      } catch {
        // not critical
      }
    }
    fetchGithubStatus()
  }, [])

  // Detect ?github=connected after OAuth redirect
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("github") === "connected") {
      setGithubBanner(true)
      // Re-fetch status to pick up the new connection
      async function refetch() {
        try {
          const res = await fetch("/api/github/status", { headers: { ...getAuthHeaders() } })
          const json = await res.json()
          if (json.success) setGithubStatus(json.data)
        } catch { /* ignore */ }
      }
      refetch()
      // Clean the URL param without a page reload
      const url = new URL(window.location.href)
      url.searchParams.delete("github")
      window.history.replaceState({}, "", url.toString())
      // Auto-hide the banner after 4 s
      const t = setTimeout(() => setGithubBanner(false), 4000)
      return () => clearTimeout(t)
    }
  }, [])

  const handleGithubConnect = useCallback(async () => {
    setGithubLoading(true)
    try {
      const res = await fetch("/api/github/connect", {
        headers: { ...getAuthHeaders() },
      })
      const json = await res.json()
      if (json.success && json.data?.oauth_url) {
        window.location.href = json.data.oauth_url
      } else {
        console.error("GitHub connect error:", json.error)
      }
    } catch (e) {
      console.error("GitHub connect error:", e)
    } finally {
      setGithubLoading(false)
    }
  }, [])

  const uploadFile = useCallback(
    async (file: File) => {
      const name = file.name
      setUploads((prev) => [
        ...prev,
        { name, status: "uploading" as UploadStatus },
      ])

      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { ...getAuthHeaders() },
          body: formData,
        })
        const json = await res.json()

        if (json.success) {
          setUploads((prev) =>
            prev.map((u) =>
              u.name === name
                ? {
                    ...u,
                    status: "done" as UploadStatus,
                    chunks: json.data?.chunks_stored || 0,
                  }
                : u
            )
          )
          onFilesChange()
        } else {
          setUploads((prev) =>
            prev.map((u) =>
              u.name === name
                ? {
                    ...u,
                    status: "error" as UploadStatus,
                    error: json.error || "Upload failed",
                  }
                : u
            )
          )
        }
      } catch (e) {
        setUploads((prev) =>
          prev.map((u) =>
            u.name === name
              ? { ...u, status: "error" as UploadStatus, error: String(e) }
              : u
          )
        )
      }
    },
    [onFilesChange]
  )

  const handleFiles = useCallback(
    (fileList: FileList) => {
      Array.from(fileList).forEach(uploadFile)
    },
    [uploadFile]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-cm-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cm-accent">
          <IconFolderOpen size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-cm-text">CodeMind</h2>
          <p className="text-[10px] text-cm-text-muted">
            {files.length} file{files.length !== 1 ? "s" : ""} indexed
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="p-3">
        <div
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragOver
              ? "border-cm-accent bg-cm-accent/10"
              : "border-cm-border hover:border-cm-text-muted"
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <IconUpload
            size={24}
            className={isDragOver ? "text-cm-accent" : "text-cm-text-muted"}
          />
          <p className="mt-2 text-xs text-cm-text-secondary">
            Drop files or ZIP here
          </p>
          <p className="mt-1 text-[10px] text-cm-text-muted">
            .py .js .ts .go .java .cpp .rs .md
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept=".py,.js,.ts,.tsx,.jsx,.go,.java,.cpp,.c,.h,.rs,.rb,.php,.cs,.swift,.kt,.md,.txt,.yaml,.yml,.json,.toml,.zip"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* GitHub section */}
      <div className="px-3 pb-2">
        {/* Success banner after OAuth redirect */}
        {githubBanner && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-cm-green/10 px-2.5 py-2 text-xs text-cm-green">
            <IconCheck size={12} />
            GitHub connected as @{githubStatus.username}
          </div>
        )}

        {githubStatus.connected ? (
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-1.5 rounded-md bg-cm-card px-2.5 py-1.5">
              <IconBrandGithub size={13} className="shrink-0 text-cm-text-muted" />
              <span className="truncate text-[11px] text-cm-text-secondary">
                @{githubStatus.username}
              </span>
            </div>
            <Button
              size="sm"
              className="h-7 shrink-0 bg-cm-accent px-2.5 text-[11px] hover:bg-cm-accent-dim"
              onClick={() => setShowRepoModal(true)}
            >
              Import repo
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full gap-1.5 border border-cm-border text-[11px] text-cm-text-muted hover:border-cm-text-muted hover:text-cm-text"
            onClick={handleGithubConnect}
            disabled={githubLoading}
          >
            {githubLoading ? (
              <IconLoader2 size={13} className="animate-spin" />
            ) : (
              <IconBrandGithub size={13} />
            )}
            Connect GitHub for private repos
          </Button>
        )}
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="px-3 pb-2">
          <div className="space-y-1.5">
            {uploads.slice(-5).map((u, i) => (
              <div
                key={`${u.name}-${i}`}
                className="flex items-center gap-2 rounded-md bg-cm-card px-2.5 py-1.5"
              >
                {u.status === "uploading" && (
                  <IconLoader2
                    size={12}
                    className="animate-spin text-cm-accent"
                  />
                )}
                {u.status === "done" && (
                  <IconCheck size={12} className="text-cm-green" />
                )}
                {u.status === "error" && (
                  <IconX size={12} className="text-cm-red" />
                )}
                <span className="flex-1 truncate text-[11px] text-cm-text-secondary">
                  {u.name}
                </span>
                {u.status === "done" && u.chunks !== undefined && (
                  <span className="text-[10px] text-cm-text-muted">
                    {u.chunks} chunks
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator className="bg-cm-border" />

      {/* Indexed Files */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-[11px] font-medium tracking-wider text-cm-text-muted uppercase">
          Indexed Files
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[10px] text-cm-text-muted hover:text-cm-text"
          onClick={onFilesChange}
        >
          Refresh
        </Button>
      </div>

      {showRepoModal && (
        <GitHubRepoModal
          onClose={() => setShowRepoModal(false)}
          onIngested={() => {
            onFilesChange()
            setShowRepoModal(false)
          }}
        />
      )}

      <ScrollArea className="h-7/12 px-3 pb-3">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IconFile size={32} className="text-cm-text-muted/30" />
            <p className="mt-3 text-xs text-cm-text-muted">
              No files indexed yet
            </p>
            <p className="mt-1 text-[10px] text-cm-text-muted">
              Upload code files to get started
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((f) => (
              <button
                key={f.file_path}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                  selectedFile === f.file_path
                    ? "bg-cm-accent/15 text-cm-accent"
                    : "text-cm-text-secondary hover:bg-cm-card hover:text-cm-text"
                }`}
                onClick={() => onFileSelect(f)}
              >
                <IconFile size={14} className="shrink-0" />
                <span className="flex-1 truncate text-[11px]">
                  {f.file_path}
                </span>
                <Badge
                  variant="secondary"
                  className={`h-4 px-1.5 text-[9px] font-normal ${langColor(f.language)}`}
                >
                  {f.language}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
