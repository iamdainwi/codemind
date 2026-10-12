"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat, clearChatHistory } from "@/lib/api/chat";
import type { ChatMessage } from "@/types/api";

interface Props {
  params: Promise<{ repoId: string }>;
}

function MessageBubble({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isHuman = msg.role === "human";
  return (
    <div className={`flex ${isHuman ? "justify-end" : "justify-start"}`}>
      {!isHuman && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 mr-2">
          C
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isHuman
            ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        }`}
      >
        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
        {msg.streaming && (
          <span className="inline-block w-2 h-4 bg-current opacity-70 ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}

export default function ChatPage({ params }: Props) {
  const [repoId, setRepoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    params.then((p) => setRepoId(p.repoId));
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming || !repoId) return;
    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "human", content: query }]);
    setStreaming(true);

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      for await (const token of streamChat(repoId, query)) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + token, streaming: true };
          }
          return updated;
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stream error.";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `Error: ${message}` };
        return updated;
      });
    } finally {
      setStreaming(false);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant") {
          updated[updated.length - 1] = { ...last, streaming: false };
        }
        return updated;
      });
    }
  }, [input, streaming, repoId]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleClear() {
    if (!repoId) return;
    await clearChatHistory(repoId);
    setMessages([]);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/80 backdrop-blur shrink-0">
        <div>
          <h1 className="font-semibold text-foreground">Chat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Repo: <span className="font-mono">{repoId}</span>
          </p>
        </div>
        <button
          id="clear-history-btn"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted"
        >
          Clear history
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center text-2xl mb-4">
              💬
            </div>
            <p className="font-medium text-foreground mb-1">Ask about your codebase</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              CodeMind uses AST-aware retrieval to find the most relevant code before answering.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border bg-background/80 backdrop-blur shrink-0">
        <div className="flex items-end gap-3 max-w-3xl mx-auto">
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
            }}
            onKeyDown={handleKey}
            placeholder="Ask a question about the codebase… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none px-4 py-3 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all disabled:opacity-50"
          />
          <button
            id="send-btn"
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span className="text-sm">↑</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
