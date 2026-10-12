"use client";

import type { ChatMessage } from "@/types/api";
import { StreamingText } from "./StreamingText";

interface MessageBubbleProps {
  msg: ChatMessage & { streaming?: boolean };
}

export function MessageBubble({ msg }: MessageBubbleProps) {
  const isHuman = msg.role === "human";

  return (
    <div className={`flex w-full ${isHuman ? "justify-end" : "justify-start"} my-2`}>
      {!isHuman && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 mr-3 shadow-md shadow-violet-500/20">
          C
        </div>
      )}
      <div
        className={`max-w-[78%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
          isHuman
            ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-xs shadow-violet-600/10"
            : "bg-card/80 backdrop-blur-md border border-border/80 text-foreground rounded-tl-xs"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {isHuman ? "You" : "CodeMind (AST RAG)"}
          </span>
        </div>
        <StreamingText content={msg.content} isStreaming={msg.streaming} />
      </div>
    </div>
  );
}
