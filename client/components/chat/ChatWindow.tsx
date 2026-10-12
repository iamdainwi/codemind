"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/types/api";
import { MessageBubble } from "./MessageBubble";

interface ChatWindowProps {
  messages: (ChatMessage & { streaming?: boolean })[];
  streaming: boolean;
  repoName?: string;
  onClearHistory?: () => void;
}

export function ChatWindow({
  messages,
  streaming,
  repoName,
  onClearHistory,
}: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/40 backdrop-blur-sm">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span>{repoName ? `${repoName}` : "Codebase Chat"}</span>
            <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
              AST Mode
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Semantic tree-sitter chunk retrieval powered by local Ollama
          </p>
        </div>
        {onClearHistory && (
          <button
            onClick={onClearHistory}
            disabled={streaming}
            className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 text-xl font-bold mb-4">
              ?
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Ask anything about this codebase
            </p>
            <p className="text-xs max-w-sm">
              CodeMind parses Python functions, classes, and methods using tree-sitter AST
              to retrieve complete syntactic structures rather than fragmented slices.
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
