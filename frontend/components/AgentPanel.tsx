"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  IconSend2,
  IconLoader2,
  IconUser,
  IconBrain,
  IconCheck,
  IconCircleDashed,
} from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
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

export default function AgentPanel() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = async () => {
    const q = input.trim();
    if (!q || isLoading) return;

    setInput("");
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
              // skip
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
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/15">
                <IconBrain size={24} className="text-cm-accent" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-cm-text">
                Agentic Q&A
              </h3>
              <p className="mt-1.5 max-w-sm text-xs text-cm-text-muted">
                Ask complex questions. The agent decomposes your query, runs
                multiple searches, and synthesizes a comprehensive answer.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="group">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    msg.role === "user" ? "bg-cm-card" : "bg-cm-accent/15"
                  }`}
                >
                  {msg.role === "user" ? (
                    <IconUser size={14} className="text-cm-text-secondary" />
                  ) : (
                    <IconBrain size={14} className="text-cm-accent" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted">
                    {msg.role === "user" ? "You" : "CodeMind Agent"}
                  </span>

                  {msg.role === "user" ? (
                    <p className="mt-1 text-sm text-cm-text">{msg.content}</p>
                  ) : (
                    <>
                      {/* Agent Steps */}
                      {msg.steps && msg.steps.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.steps.map((step) => (
                            <div
                              key={step.step}
                              className="flex items-center gap-2 rounded-md bg-cm-card px-3 py-2"
                            >
                              {step.status === "done" ? (
                                <IconCheck
                                  size={14}
                                  className="shrink-0 text-cm-green"
                                />
                              ) : (
                                <IconCircleDashed
                                  size={14}
                                  className="shrink-0 animate-spin text-cm-accent"
                                />
                              )}
                              <span className="text-xs text-cm-text-secondary">
                                Step {step.step}:{" "}
                                <span
                                  className={
                                    step.status === "done"
                                      ? "text-cm-text"
                                      : "text-cm-accent"
                                  }
                                >
                                  {step.message}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Sub-questions */}
                      {msg.subquestions && msg.subquestions.length > 0 && (
                        <div className="mt-3 rounded-md border border-cm-border bg-cm-bg p-3">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                            Sub-questions explored
                          </p>
                          <ul className="space-y-1">
                            {msg.subquestions.map((sq, j) => (
                              <li
                                key={j}
                                className="flex items-start gap-2 text-xs text-cm-text-secondary"
                              >
                                <span className="mt-0.5 shrink-0 text-cm-accent">
                                  →
                                </span>
                                {sq}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Answer */}
                      {msg.content && (
                        <div className="prose-invert mt-3 text-sm">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ className, children, ...props }) {
                                const match = /language-(\w+)/.exec(
                                  className || "",
                                );
                                const codeStr = String(children).replace(
                                  /\n$/,
                                  "",
                                );
                                if (match) {
                                  return (
                                    <div className="my-2 overflow-hidden rounded-md border border-cm-border">
                                      <div className="flex items-center bg-cm-card px-3 py-1.5">
                                        <span className="text-[10px] text-cm-text-muted">
                                          {match[1]}
                                        </span>
                                      </div>
                                      <SyntaxHighlighter
                                        style={oneDark}
                                        language={match[1]}
                                        PreTag="div"
                                        customStyle={{
                                          margin: 0,
                                          padding: "12px",
                                          background: "#0d0d0d",
                                          fontSize: "12px",
                                        }}
                                      >
                                        {codeStr}
                                      </SyntaxHighlighter>
                                    </div>
                                  );
                                }
                                return (
                                  <code
                                    className="rounded bg-cm-card px-1.5 py-0.5 text-xs text-cm-accent"
                                    {...props}
                                  >
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
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.isStreaming && (
                            <span className="animate-blink inline-block h-4 w-1.5 bg-cm-accent" />
                          )}
                        </div>
                      )}

                      {/* Sources */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {msg.sources.map((s, j) => (
                            <Badge
                              key={j}
                              variant="outline"
                              className="border-cm-border bg-cm-card/50 text-[10px] text-cm-text-muted"
                            >
                              {s.file_path}
                              <span className="ml-1 text-cm-accent">
                                {(s.score * 100).toFixed(0)}%
                              </span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-cm-border p-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2 rounded-lg border border-cm-border bg-cm-card p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask a complex question about your codebase..."
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
              className="h-8 w-8 bg-cm-accent hover:bg-cm-accent-dim"
              onClick={handleSubmit}
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
