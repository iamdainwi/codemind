"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  IconSend2,
  IconLoader2,
  IconBrain,
  IconTrash,
} from "@tabler/icons-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import CodeBlock from "@/components/CodeBlock"
import { getAuthHeaders } from "@/lib/auth"

interface Source {
  file_path: string
  score: number
  language: string
}

interface Message {
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  isStreaming?: boolean
}

interface ChatPanelProps {
  pendingQuestion?: string
  onPendingConsumed?: () => void
}

const SUGGESTIONS = [
  "How does authentication work in this codebase?",
  "What are the main API endpoints?",
  "Explain the database schema",
  "How is error handling implemented?",
]

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-cm-green"
  if (score >= 0.5) return "text-cm-yellow"
  return "text-cm-text-muted"
}

export default function ChatPanel({
  pendingQuestion,
  onPendingConsumed,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingConsumedRef = useRef(false)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSubmit = useCallback(
    async (overrideQuestion?: string) => {
      const q = (overrideQuestion ?? input).trim()
      if (!q || isLoading) return

      setInput("")
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
      setIsLoading(true)

      const userMsg: Message = { role: "user", content: q }
      setMessages((prev) => [...prev, userMsg])

      let content = ""
      let sources: Source[] = []

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", sources: [], isStreaming: true },
      ])

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ question: q, top_k: 6 }),
        })

        if (!res.ok) throw new Error(`Server error: ${res.status}`)

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const parts = buffer.split("\n\n")
            buffer = parts.pop() || ""

            for (const part of parts) {
              const lines = part.split("\n")
              let eventType = ""
              let eventData = ""

              for (const line of lines) {
                if (line.startsWith("event: ")) eventType = line.slice(7).trim()
                if (line.startsWith("data: ")) eventData = line.slice(6)
              }

              if (!eventData) continue

              try {
                const parsed = JSON.parse(eventData)

                if (eventType === "token") {
                  content += parsed
                  setMessages((prev) => {
                    const copy = [...prev]
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content,
                      sources,
                      isStreaming: true,
                    }
                    return copy
                  })
                } else if (eventType === "sources") {
                  sources = parsed
                  setMessages((prev) => {
                    const copy = [...prev]
                    copy[copy.length - 1] = {
                      ...copy[copy.length - 1],
                      sources,
                    }
                    return copy
                  })
                } else if (eventType === "done") {
                  setMessages((prev) => {
                    const copy = [...prev]
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content,
                      sources,
                      isStreaming: false,
                    }
                    return copy
                  })
                } else if (eventType === "error") {
                  content = `Error: ${parsed}`
                  setMessages((prev) => {
                    const copy = [...prev]
                    copy[copy.length - 1] = {
                      role: "assistant",
                      content,
                      sources,
                      isStreaming: false,
                    }
                    return copy
                  })
                }
              } catch {
                // skip malformed events
              }
            }
          }
        }

        // Final state
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: "assistant",
            content: content || "No response received.",
            sources,
            isStreaming: false,
          }
          return copy
        })
      } catch (e) {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Error: ${e}`,
            isStreaming: false,
          }
          return copy
        })
      }

      setIsLoading(false)
    },
    [input, isLoading]
  )

  // Auto-submit pendingQuestion when it arrives
  useEffect(() => {
    if (pendingQuestion && pendingQuestion.trim() && !pendingConsumedRef.current) {
      pendingConsumedRef.current = true
      const q = pendingQuestion
      onPendingConsumed?.()
      // Give the component a tick to settle, then submit
      setTimeout(() => {
        pendingConsumedRef.current = false
        handleSubmit(q)
      }, 50)
    }
  }, [pendingQuestion, handleSubmit, onPendingConsumed])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSuggestion = (s: string) => {
    handleSubmit(s)
  }

  const handleNewConversation = () => {
    setMessages([])
    setInput("")
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <ScrollArea className="h-72 flex-1 px-4" viewportRef={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-6 py-6">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/15">
                <IconBrain size={24} className="text-cm-accent" />
              </div>
              <h3 className="mt-4 text-sm font-medium text-cm-text">
                Ask your codebase
              </h3>
              <p className="mt-1.5 max-w-sm text-xs text-cm-text-muted">
                Upload code files, then ask questions in plain English. Answers
                are grounded in your actual source code with citations.
              </p>

              {/* Suggested questions */}
              <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
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
                onClick={handleNewConversation}
                className="flex h-7 items-center gap-1.5 px-2 text-[11px] text-cm-text-muted hover:text-cm-text"
              >
                <IconTrash size={12} />
                New conversation
              </Button>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div key={i} className="animate-fadeIn">
              {msg.role === "user" ? (
                /* User message — right aligned pill */
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
                /* Assistant message — left aligned */
                <div className="flex flex-col">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                    CodeMind
                  </p>
                  <div className="prose-invert text-sm">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children }) {
                          const match = /language-(\w+)/.exec(className || "")
                          const codeStr = String(children).replace(/\n$/, "")
                          if (match) {
                            return (
                              <CodeBlock
                                language={match[1]}
                                code={codeStr}
                              />
                            )
                          }
                          return (
                            <code className="rounded bg-cm-card px-1.5 py-0.5 text-xs text-cm-accent">
                              {children}
                            </code>
                          )
                        },
                        p({ children }) {
                          return (
                            <p className="mb-2 text-sm leading-relaxed text-cm-text-secondary">
                              {children}
                            </p>
                          )
                        },
                        li({ children }) {
                          return (
                            <li className="text-sm text-cm-text-secondary">
                              {children}
                            </li>
                          )
                        },
                        ul({ children }) {
                          return (
                            <ul className="mb-2 list-disc pl-4 text-cm-text-secondary">
                              {children}
                            </ul>
                          )
                        },
                        ol({ children }) {
                          return (
                            <ol className="mb-2 list-decimal pl-4 text-cm-text-secondary">
                              {children}
                            </ol>
                          )
                        },
                        h1({ children }) {
                          return (
                            <h1 className="mb-2 text-base font-semibold text-cm-text">
                              {children}
                            </h1>
                          )
                        },
                        h2({ children }) {
                          return (
                            <h2 className="mb-1.5 text-sm font-semibold text-cm-text">
                              {children}
                            </h2>
                          )
                        },
                        h3({ children }) {
                          return (
                            <h3 className="mb-1 text-xs font-semibold text-cm-text">
                              {children}
                            </h3>
                          )
                        },
                        blockquote({ children }) {
                          return (
                            <blockquote className="mb-2 border-l-2 border-cm-accent pl-3 text-cm-text-secondary">
                              {children}
                            </blockquote>
                          )
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.isStreaming && (
                      <span className="animate-blink ml-0.5 inline-block h-[14px] w-[7px] translate-y-[2px] bg-cm-accent" />
                    )}
                  </div>

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
                            <span className={`font-mono ${scoreColor(s.score)}`}>
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
              placeholder="Ask about your codebase... (Shift+Enter for newline)"
              rows={1}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:outline-none"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 120) + "px"
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
            Answers are grounded in your indexed codebase with citations
          </p>
        </div>
      </div>
    </div>
  )
}
