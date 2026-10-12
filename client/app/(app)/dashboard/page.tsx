"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { listRepos, uploadRepo, deleteRepo } from "@/lib/api/repos";
import type { Repo } from "@/types/api";

function StatusBadge({ status }: { status: Repo["status"] }) {
  const map = {
    ready: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    indexing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    pending: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "indexing" ? "animate-pulse" : ""} bg-current`} />
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    const res = await listRepos();
    if (res.success && res.data) setRepos(res.data);
  }, []);

  useEffect(() => {
    fetchRepos();
    // Poll every 4s for repos that are still indexing
    const interval = setInterval(() => {
      setRepos((prev) => {
        if (prev.some((r) => r.status === "indexing" || r.status === "pending")) {
          fetchRepos();
        }
        return prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchRepos]);

  async function handleUpload(file: File) {
    if (!file.name.endsWith(".zip")) {
      setUploadError("Only .zip files are accepted.");
      return;
    }
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
      setUploadError("Upload failed. Is the server running?");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(repoId: string) {
    await deleteRepo(repoId);
    setRepos((prev) => prev.filter((r) => r.repo_id !== repoId));
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Upload your Python codebase as a ZIP to start asking questions.
        </p>
      </div>

      {/* Upload zone */}
      <div
        id="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ${
          dragging
            ? "border-violet-500 bg-violet-500/10"
            : "border-border hover:border-violet-500/50 hover:bg-muted/30"
        }`}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-cyan-500/5 pointer-events-none" />
        <div className="text-4xl mb-3">📦</div>
        <p className="text-sm font-medium text-foreground mb-1">
          {dragging ? "Drop your ZIP here" : "Drag & drop your Python codebase ZIP"}
        </p>
        <p className="text-xs text-muted-foreground mb-4">or click to browse</p>
        <label
          htmlFor="file-input"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 text-white text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          {uploading ? (
            <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
          ) : (
            "Choose ZIP File"
          )}
        </label>
        <input
          id="file-input"
          type="file"
          accept=".zip"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        {uploadError && (
          <p className="mt-3 text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      {/* Repos list */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Indexed Repositories ({repos.length})
        </h2>

        {repos.length === 0 ? (
          <div className="rounded-xl border border-border bg-card/50 p-8 text-center">
            <p className="text-muted-foreground text-sm">No repositories yet. Upload a ZIP to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {repos.map((repo) => (
              <div
                key={repo.repo_id}
                className="group flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card/50 hover:bg-card transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <p className="font-medium text-sm text-foreground truncate">{repo.name}</p>
                    <StatusBadge status={repo.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {repo.file_count} files · {repo.chunk_count_ast} AST chunks · {repo.chunk_count_fixed} fixed chunks
                  </p>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {repo.status === "ready" && (
                    <button
                      id={`chat-btn-${repo.repo_id}`}
                      onClick={() => router.push(`/chat/${repo.repo_id}`)}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
                    >
                      Chat
                    </button>
                  )}
                  <button
                    id={`delete-btn-${repo.repo_id}`}
                    onClick={() => handleDelete(repo.repo_id)}
                    className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                  >
                    Delete
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
