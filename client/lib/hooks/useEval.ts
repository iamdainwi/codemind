"use client";
import { useState, useCallback } from "react";
import { getEvalResults, triggerEval, listAllEvalResults } from "@/lib/api/eval";
import type { EvalResult } from "@/types/api";

export function useEval(repoId?: string) {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [allResults, setAllResults] = useState<EvalResult[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getEvalResults(repoId);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setResult(null);
      }
    } catch {
      setError("Failed to load evaluation results.");
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  const fetchAllResults = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAllEvalResults();
      if (res.success && res.data) {
        setAllResults(res.data);
      }
    } catch {
      setError("Failed to load evaluation list.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runEvaluation = useCallback(
    async (datasetId = "python_oss_sample") => {
      if (!repoId) return;
      setRunning(true);
      setError(null);
      try {
        const res = await triggerEval(repoId, datasetId);
        if (!res.success) {
          setError(res.error?.message ?? "Failed to trigger evaluation.");
          setRunning(false);
          return null;
        }

        // Poll for results
        const interval = setInterval(async () => {
          try {
            const pollRes = await getEvalResults(repoId);
            if (pollRes.success && pollRes.data) {
              setResult(pollRes.data);
              if (pollRes.data.status === "completed" || pollRes.data.status === "failed") {
                clearInterval(interval);
                setRunning(false);
              }
            }
          } catch {
            // Keep trying
          }
        }, 3000);

        return res.data;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Evaluation trigger failed.";
        setError(msg);
        setRunning(false);
        return null;
      }
    },
    [repoId]
  );

  return {
    result,
    allResults,
    running,
    loading,
    error,
    fetchResults,
    fetchAllResults,
    runEvaluation,
  };
}
