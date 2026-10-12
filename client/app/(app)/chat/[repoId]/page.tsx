"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { streamChat, clearChatHistory, getChatHistory } from "@/lib/api/chat";
import { getRepo } from "@/lib/api/repos";
import type { ChatMessage, RepoDetail } from "@/types/api";
import {
  ArrowLeft,
  Send,
  Trash2,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  Copy,
  Check,
  Code2,
} from "lucide-react";

interface Props {
  params: Promise<{ repoId: string }>;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl border border-border/80 bg-zinc-950/80 overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-zinc-900/60 text-muted-foreground">
        <span className="text-[11px] font-medium">{lang || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-foreground transition-colors text-[10px]"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-zinc-100 leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function FormattedContent({ content }: { content: string }) {
  // Simple parser to format ``` code blocks cleanly
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-xs leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const lines = part.slice(3, -3).trim().split("\n");
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : undefined;
          const code = hasLang ? lines.slice(1).join("\n") : lines.join("\n");
          return <CodeBlock key={index} code={code} lang={lang} />;
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {part}
          </p>
        );
      })}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage & { streaming?: boolean } }) {
  const isHuman = msg.role === "human";

  return (
    <div className={`flex w-full ${isHuman ? "justify-end" : "justify-start"} my-2`}>
      <div className={`flex gap-3 max-w-[82%] ${isHuman ? "flex-row-reverse" : "flex-row"}`}>
        {!isHuman ? (
          <div className="size-7 rounded-lg bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5 shadow-xs">
            <Terminal className="size-3.5" />
          </div>
        ) : (
          <div className="size-7 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 text-xs font-semibold shrink-0 mt-0.5">
            You
          </div>
        )}

        <div
          className={`px-4 py-3 rounded-2xl transition-all shadow-xs ${
            isHuman
              ? "bg-violet-600 text-white rounded-tr-xs"
              : "bg-card/70 border border-border/80 text-foreground rounded-tl-xs backdrop-blur-sm"
          }`}
        >
          <FormattedContent content={msg.content} />
          {msg.streaming && (
            <span
              className="inline-block size-2 rounded-full bg-violet-400 animate-pulse ml-1 align-middle"
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ params }: Props) {
  const [repoId, setRepoId] = useState<string | null>(null);
  const [repoDetail, setRepoDetail] = useState<RepoDetail | null>(null);
  const [messages, setMessages] = useState<(ChatMessage & { streaming?: boolean })[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    params.then((p) => {
      setRepoId(p.repoId);
      // Fetch repo metadata
      getRepo(p.repoId).then((res) => {
        if (res.success && res.data) setRepoDetail(res.data);
      });
      // Fetch existing history
      getChatHistory(p.repoId).then((res) => {
        if (res.success && res.data) setMessages(res.data);
      });
    });
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const query = (textToSend || input).trim();
      if (!query || streaming || !repoId) return;

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
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
                streaming: true,
              };
            }
            return updated;
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Streaming failed.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: `Error streaming response: ${message}`,
          };
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
    },
    [input, streaming, repoId]
  );

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

  const promptSuggestions = [
    "Explain the overall architecture and data flow of this codebase.",
    "Which classes and methods are responsible for core operations?",
    "Show me how errors and exceptions are structured.",
  ];

  return (
    <div className="flex flex-col h-full bg-background/50">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-border/80 bg-card/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm text-foreground">
                {repoDetail?.name || repoId || "Codebase Chat"}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                AST RAG
              </span>
            </div>
            {repoDetail && (
              <span className="text-[11px] text-muted-foreground font-mono">
                {repoDetail.file_count} files • {repoDetail.chunk_count_ast} AST chunks
              </span>
            )}
          </div>
        </div>

        <button
          id="clear-history-btn"
          onClick={handleClear}
          title="Clear chat history"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg hover:bg-muted/60 border border-border/60 font-mono"
        >
          <Trash2 className="size-3.5" />
          <span>Clear History</span>
        </button>
      </header>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 space-y-4">
            <div className="size-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shadow-sm">
              <Code2 className="size-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                Query {repoDetail?.name || "Codebase"}
              </h2>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                CodeMind uses tree-sitter AST to extract whole functions and class declarations, providing exact qualified context to local Ollama models.
              </p>
            </div>

            {/* Prompt Suggestions */}
            <div className="flex flex-col gap-2 pt-2 max-w-md w-full">
              {promptSuggestions.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  className="px-3.5 py-2 rounded-xl bg-card/60 hover:bg-card border border-border/70 hover:border-violet-500/40 text-left text-xs text-muted-foreground hover:text-foreground transition-all flex items-center justify-between group"
                >
                  <span className="truncate">{prompt}</span>
                  <Sparkles className="size-3 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="px-6 py-4 border-t border-border/80 bg-card/40 backdrop-blur-md shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          <div className="relative flex items-end gap-2 bg-card/80 border border-border/80 rounded-2xl p-2 shadow-xs focus-within:border-violet-500/60 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all">
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
              placeholder="Ask a question about functions, classes, or architecture…"
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none px-3 py-1.5 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40 font-sans"
            />

            <button
              id="send-btn"
              onClick={() => handleSend()}
              disabled={streaming || !input.trim()}
              className="size-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 active:scale-[0.98] shadow-xs"
            >
              {streaming ? (
                <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground font-mono">
            <span>Press ↵ to send, ⇧↵ for newline</span>
            <span>Local & Private via Ollama</span>
          </div>
        </div>
      </div>
    </div>
  );
}
