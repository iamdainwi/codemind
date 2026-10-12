"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { uploadRepo, getRepo } from "@/lib/api/repos";
import type { RepoDetail } from "@/types/api";

export function useIngest() {
  const [uploading, setUploading] = useState(false);
  const [activeRepo, setActiveRepo] = useState<RepoDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollRepoStatus = useCallback(
    (repoId: string, onComplete?: (repo: RepoDetail) => void) => {
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await getRepo(repoId);
          if (res.success && res.data) {
            setActiveRepo(res.data);
            if (res.data.status === "ready" || res.data.status === "error") {
              stopPolling();
              if (onComplete) onComplete(res.data);
            }
          }
        } catch {
          // Keep polling on intermittent network blip
        }
      }, 2500);
    },
    [stopPolling]
  );

  const startUpload = useCallback(
    async (file: File, onComplete?: (repo: RepoDetail) => void) => {
      if (!file.name.endsWith(".zip")) {
        setError("Only .zip files are allowed.");
        return null;
      }
      setError(null);
      setUploading(true);
      try {
        const res = await uploadRepo(file);
        if (!res.success) {
          setError(res.error?.message ?? "Upload failed.");
          setUploading(false);
          return null;
        }

        const repoId = res.data?.repo_id;
        if (repoId) {
          pollRepoStatus(repoId, (repo) => {
            setUploading(false);
            if (onComplete) onComplete(repo);
          });
        }
        return res.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Network error during upload.";
        setError(msg);
        setUploading(false);
        return null;
      }
    },
    [pollRepoStatus]
  );

  return {
    uploading,
    activeRepo,
    error,
    startUpload,
    stopPolling,
  };
}
