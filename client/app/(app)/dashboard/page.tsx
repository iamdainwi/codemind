"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listRepos, uploadRepo, deleteRepo } from "@/lib/api/repos";
import type { Repo } from "@/types/api";
import { ZipUploader } from "@/components/upload/ZipUploader";
import {
  FolderGit2,
  MessageSquare,
  BarChart2,
  Trash2,
  Layers,
  FileCode2,
  Cpu,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";

function StatusBadge({ status }: { status: Repo["status"] }) {
  const map = {
    ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    indexing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    pending: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    error: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${map[status]}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          status === "indexing" ? "animate-pulse" : ""
        } bg-current`}
      />
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    const res = await listRepos();
    if (res.success && res.data) setRepos(res.data);
  }, []);

  useEffect(() => {
    fetchRepos();
    // Poll every 3s if any repo is currently indexing
    const interval = setInterval(() => {
      setRepos((prev) => {
        if (prev.some((r) => r.status === "indexing" || r.status === "pending")) {
          fetchRepos();
        }
        return prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchRepos]);

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const res = await uploadRepo(file);
      if (res.success) {
        await fetchRepos();
      } else {
        setUploadError(res.error?.message ?? "Upload failed.");
      }
    } catch {
      setUploadError("Upload failed. Verify backend service is healthy.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(repoId: string) {
    if (!confirm("Are you sure you want to delete this indexed repository?")) return;
    await deleteRepo(repoId);
    setRepos((prev) => prev.filter((r) => r.repo_id !== repoId));
  }

  const totalAstChunks = repos.reduce((acc, r) => acc + (r.chunk_count_ast || 0), 0);
  const totalFixedChunks = repos.reduce((acc, r) => acc + (r.chunk_count_fixed || 0), 0);
  const totalFiles = repos.reduce((acc, r) => acc + (r.file_count || 0), 0);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Page Title & Mission */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <span>Repository Workspace</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
              AST Dual Indexer
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Upload Python source repositories to compare tree-sitter AST syntax chunking against traditional fixed-window baseline chunking in local ChromaDB collections.
          </p>
        </div>

        <Link
          href="/eval"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border/80 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors shrink-0 shadow-xs"
        >
          <BarChart2 className="size-3.5 text-violet-400" />
          <span>Evaluation Matrix</span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </Link>
      </div>

      {/* Bento Metric Summary Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Repositories</span>
            <FolderGit2 className="size-3.5 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {repos.length}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {repos.filter((r) => r.status === "ready").length} ready for queries
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Python Files</span>
            <FileCode2 className="size-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {totalFiles}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Parsed with tree-sitter
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>AST Semantic Chunks</span>
            <Cpu className="size-3.5 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-400">
            {totalAstChunks}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Function, class & method units
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/70 bg-card/40 backdrop-blur-sm space-y-1">
          <div className="flex items-center justify-between text-muted-foreground text-xs">
            <span>Fixed Baseline Chunks</span>
            <Layers className="size-3.5 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold font-mono text-muted-foreground">
            {totalFixedChunks}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Character window slices
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Index New Codebase</span>
            <span className="size-1.5 rounded-full bg-violet-400" />
          </h2>
          <span className="text-[11px] font-mono text-muted-foreground">
            Automatic background indexing
          </span>
        </div>

        <ZipUploader
          onUpload={handleUpload}
          uploading={uploading}
        />
        {uploadError && (
          <p className="text-xs text-destructive mt-2">{uploadError}</p>
        )}
      </div>

      {/* Repository List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span>Indexed Codebases</span>
            <span className="text-xs text-muted-foreground font-mono">({repos.length})</span>
          </h2>
          {repos.some((r) => r.status === "indexing") && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-mono animate-pulse">
              <Clock className="size-3" />
              <span>Indexing in progress…</span>
            </span>
          )}
        </div>

        {repos.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card/30 p-12 text-center space-y-3">
            <div className="size-12 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground mx-auto">
              <FolderGit2 className="size-6 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-foreground">No repositories indexed yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Compress your Python repository root into a <code className="text-violet-400 font-mono">.zip</code> archive and drop it above to generate semantic AST chunks and vector embeddings.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {repos.map((repo) => (
              <div
                key={repo.repo_id}
                className="group relative rounded-xl border border-border/70 bg-card/40 hover:bg-card/70 hover:border-violet-500/40 p-5 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Repo Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="size-10 rounded-lg bg-gradient-to-br from-violet-500/10 to-indigo-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0 mt-0.5">
                    <FolderGit2 className="size-5" />
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-semibold text-sm text-foreground truncate">
                        {repo.name}
                      </h3>
                      <StatusBadge status={repo.status} />
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap font-mono">
                      <span>{repo.file_count} files</span>
                      <span>•</span>
                      <span className="text-violet-400 font-medium">
                        {repo.chunk_count_ast} AST chunks
                      </span>
                      <span>•</span>
                      <span>{repo.chunk_count_fixed} fixed chunks</span>
                      {repo.created_at && (
                        <>
                          <span>•</span>
                          <span className="text-muted-foreground/70">
                            {new Date(repo.created_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {repo.status === "ready" && (
                    <>
                      <Link
                        id={`chat-btn-${repo.repo_id}`}
                        href={`/chat/${repo.repo_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-all active:scale-[0.98] shadow-xs shadow-violet-600/30"
                      >
                        <MessageSquare className="size-3.5" />
                        <span>Chat Q&A</span>
                      </Link>

                      <Link
                        id={`eval-btn-${repo.repo_id}`}
                        href="/eval"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-foreground text-xs font-medium border border-border/80 transition-all"
                      >
                        <BarChart2 className="size-3.5 text-violet-400" />
                        <span>Evaluate</span>
                      </Link>
                    </>
                  )}

                  <button
                    id={`delete-btn-${repo.repo_id}`}
                    onClick={() => handleDelete(repo.repo_id)}
                    title="Delete repository index"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
