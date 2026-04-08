"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  IconSend2,
  IconLoader2,
  IconBrain,
  IconCheck,
  IconTrash,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/CodeBlock";
import { getAuthHeaders } from "@/lib/auth";

interface Source {
  file_path: string;
  score: number;
  language: string;
}

interface AgentStep {
  step: number;
  message: string;
  status: "in-progress" | "done";
}

interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  steps?: AgentStep[];
  subquestions?: string[];
  isStreaming?: boolean;
}

const SUGGESTIONS = [
  "What are all the ways authentication can fail?",
  "Trace the full request lifecycle for the /ask endpoint",
  "What external services does this app depend on?",
  "How would I add a new API endpoint?",
];

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-cm-green";
  if (score >= 0.5) return "text-cm-yellow";
  return "text-cm-text-muted";
}

function StepTimeline({ steps }: { steps: AgentStep[] }) {
  return (
    <div className="relative mt-3 pl-4">
      {/* Vertical connecting line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-cm-border" />

      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step.step} className="relative flex items-start gap-3">
            {/* Circle indicator */}
            <div
              className={`relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                step.status === "done"
                  ? "border-cm-green bg-cm-green/20"
                  : "border-cm-accent bg-cm-accent/20"
              }`}
            >
              {step.status === "done" ? (
                <IconCheck size={8} className="text-cm-green" />
              ) : (
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-cm-accent" />
              )}
            </div>

            {/* Step content */}
            <div
              className={`min-w-0 flex-1 rounded-md px-3 py-2 ${
                i === steps.length - 1 && step.status === "in-progress"
                  ? "bg-cm-accent/10 border border-cm-accent/20"
                  : "bg-cm-card"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                Step {step.step}
              </span>
              <p
                className={`mt-0.5 text-xs ${
                  step.status === "done" ? "text-cm-text-secondary" : "text-cm-accent"
                }`}
              >
                {step.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AgentPanel() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(
    async (overrideQuestion?: string) => {
      const q = (overrideQuestion ?? input).trim();
      if (!q || isLoading) return;

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsLoading(true);

      setMessages((prev) => [...prev, { role: "user", content: q }]);

      let content = "";
      let sources: Source[] = [];
      let steps: AgentStep[] = [];
      let subquestions: string[] = [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          sources: [],
          steps: [],
          subquestions: [],
          isStreaming: true,
        },
      ]);

      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ question: q }),
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              const lines = part.split("\n");
              let eventType = "";
              let eventData = "";

              for (const line of lines) {
                if (line.startsWith("event: ")) eventType = line.slice(7).trim();
                if (line.startsWith("data: ")) eventData = line.slice(6);
              }

              if (!eventData) continue;

              try {
                const parsed = JSON.parse(eventData);

                if (eventType === "step") {
                  const stepData = parsed as AgentStep;
                  const existing = steps.findIndex((s) => s.step === stepData.step);
                  if (existing >= 0) {
                    steps = [...steps];
                    steps[existing] = stepData;
                  } else {
                    steps = [...steps, stepData];
                  }
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      steps: [...steps],
                    };
                    return copy;
                  });
                } else if (eventType === "subquestions") {
                  subquestions = parsed;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      subquestions,
                    };
                    return copy;
                  });
                } else if (eventType === "sources") {
                  sources = parsed;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      sources,
                    };
                    return copy;
                  });
                } else if (eventType === "token") {
                  content += parsed;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content,
                      isStreaming: true,
                    };
                    return copy;
                  });
                } else if (eventType === "done") {
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content,
                      isStreaming: false,
                    };
                    return copy;
                  });
                } else if (eventType === "error") {
                  content = `Error: ${parsed}`;
                  setMessages((prev) => {
                    const copy = [...prev];
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      content,
                      isStreaming: false,
                    };
                    return copy;
                  });
                }
              } catch {
                // skip malformed events
              }
            }
          }
        }

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: content || "No response received.",
            sources,
            steps,
            subquestions,
            isStreaming: false,
          };
          return copy;
        });
      } catch (e) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Error: ${e}`,
            isStreaming: false,
          };
          return copy;
        });
      }

      setIsLoading(false);
    },
    [input, isLoading]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="h-4/5 px-4" viewportRef={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/15">
                <IconBrain size={24} className="text-cm-accent" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-cm-text">
                Agentic Q&amp;A
              </h3>
              <p className="mt-1.5 max-w-sm text-xs text-cm-text-muted">
                Ask complex questions. The agent decomposes your query, runs
                multiple searches, and synthesizes a comprehensive answer.
              </p>

              {/* Suggestions */}
              <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSubmit(s)}
                    className="rounded-lg border border-cm-border bg-cm-card px-3 py-2.5 text-left text-xs text-cm-text-secondary transition-colors hover:border-cm-text-muted hover:bg-cm-card-hover hover:text-cm-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New conversation button */}
          {messages.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                className="flex h-7 items-center gap-1.5 px-2 text-[11px] text-cm-text-muted hover:text-cm-text"
              >
                <IconTrash size={12} />
                New conversation
              </Button>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="animate-fadeIn">
              {msg.role === "user" ? (
                /* User message — right aligned */
                <div className="flex justify-end">
                  <div className="max-w-[75%]">
                    <p className="mb-1 text-right text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                      You
                    </p>
                    <div className="rounded-2xl rounded-br-sm bg-cm-card px-4 py-2.5">
                      <p className="text-sm text-cm-text">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant message */
                <div className="flex flex-col">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                    CodeMind Agent
                  </p>

                  {/* Timeline of steps */}
                  {msg.steps && msg.steps.length > 0 && (
                    <StepTimeline steps={msg.steps} />
                  )}

                  {/* Sub-questions grid */}
                  {msg.subquestions && msg.subquestions.length > 0 && (
                    <div className="mt-3 rounded-md border border-cm-border bg-cm-bg p-3">
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                        Sub-questions explored
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.subquestions.map((sq, j) => (
                          <span
                            key={j}
                            className="rounded-full border border-cm-border bg-cm-card px-2.5 py-1 text-[11px] text-cm-text-secondary"
                          >
                            {sq}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Answer content */}
                  {(msg.content || msg.isStreaming) && (
                    <div className="prose-invert mt-3 text-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ className, children }) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeStr = String(children).replace(/\n$/, "");
                            if (match) {
                              return (
                                <CodeBlock
                                  language={match[1]}
                                  code={codeStr}
                                />
                              );
                            }
                            return (
                              <code className="rounded bg-cm-card px-1.5 py-0.5 text-xs text-cm-accent">
                                {children}
                              </code>
                            );
                          },
                          p({ children }) {
                            return (
                              <p className="mb-2 text-sm leading-relaxed text-cm-text-secondary">
                                {children}
                              </p>
                            );
                          },
                          li({ children }) {
                            return (
                              <li className="text-sm text-cm-text-secondary">
                                {children}
                              </li>
                            );
                          },
                          ul({ children }) {
                            return (
                              <ul className="mb-2 list-disc pl-4 text-cm-text-secondary">
                                {children}
                              </ul>
                            );
                          },
                          ol({ children }) {
                            return (
                              <ol className="mb-2 list-decimal pl-4 text-cm-text-secondary">
                                {children}
                              </ol>
                            );
                          },
                          h1({ children }) {
                            return (
                              <h1 className="mb-2 text-base font-semibold text-cm-text">
                                {children}
                              </h1>
                            );
                          },
                          h2({ children }) {
                            return (
                              <h2 className="mb-1.5 text-sm font-semibold text-cm-text">
                                {children}
                              </h2>
                            );
                          },
                          h3({ children }) {
                            return (
                              <h3 className="mb-1 text-xs font-semibold text-cm-text">
                                {children}
                              </h3>
                            );
                          },
                          blockquote({ children }) {
                            return (
                              <blockquote className="mb-2 border-l-2 border-cm-accent pl-3 text-cm-text-secondary">
                                {children}
                              </blockquote>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.isStreaming && (
                        <span className="animate-blink ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] bg-cm-accent" />
                      )}
                    </div>
                  )}

                  {/* Sources */}
                  {msg.sources && msg.sources.length > 0 && !msg.isStreaming && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                        Sources
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, j) => (
                          <Badge
                            key={j}
                            variant="outline"
                            className="gap-1 border-cm-border bg-cm-card/50 text-[10px] text-cm-text-muted"
                          >
                            <span className="max-w-[180px] truncate">
                              {s.file_path}
                            </span>
                            <span
                              className={`font-mono ${scoreColor(s.score)}`}
                            >
                              {(s.score * 100).toFixed(0)}%
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-cm-border p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-lg border border-cm-border bg-cm-card p-2 focus-within:border-cm-text-muted/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a complex question... (Shift+Enter for newline)"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:outline-none"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <Button
              size="sm"
              className="h-8 w-8 shrink-0 bg-cm-accent hover:bg-cm-accent-dim"
              onClick={() => handleSubmit()}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <IconLoader2 size={14} className="animate-spin" />
              ) : (
                <IconSend2 size={14} />
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-cm-text-muted">
            Agent decomposes → multi-search → synthesize comprehensive answers
          </p>
        </div>
      </div>
    </div>
  );
}
