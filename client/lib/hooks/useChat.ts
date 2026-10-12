"use client";
import { useState, useCallback, useRef } from "react";
import { streamChat, getChatHistory, clearChatHistory } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/api";

export function useChat(repoId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await getChatHistory(repoId);
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch {
      // Ignored if history fetch fails initially
    }
  }, [repoId]);

  const sendMessage = useCallback(
    async (query: string) => {
      if (!query.trim() || streaming) return;
      setError(null);

      // Add user message immediately
      const userMsg: ChatMessage = { role: "human", content: query };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);
      setStreamingContent("");

      try {
        let accumulated = "";
        for await (const token of streamChat(repoId, query)) {
          accumulated += token;
          setStreamingContent(accumulated);
        }

        // Streaming complete, commit AI message
        if (accumulated) {
          setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error streaming response";
        setError(msg);
      } finally {
        setStreaming(false);
        setStreamingContent("");
      }
    },
    [repoId, streaming]
  );

  const clearHistory = useCallback(async () => {
    try {
      await clearChatHistory(repoId);
      setMessages([]);
      setStreamingContent("");
    } catch {
      setError("Failed to clear chat history.");
    }
  }, [repoId]);

  return {
    messages,
    streaming,
    streamingContent,
    error,
    sendMessage,
    clearHistory,
    fetchHistory,
  };
}
