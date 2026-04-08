"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  IconBrain,
  IconFile,
  IconMessageCircle,
  IconSearch,
} from "@tabler/icons-react"

interface IndexedFile {
  file_path: string
  language: string
}

interface CommandPaletteProps {
  files: IndexedFile[]
  onClose: () => void
  onNavigate: (tab: "ask" | "search" | "agent") => void
  onAskQuestion: (q: string) => void
}

const LANG_COLORS: Record<string, string> = {
  python: "bg-yellow-500/20 text-yellow-400",
  javascript: "bg-yellow-400/20 text-yellow-300",
  typescript: "bg-blue-500/20 text-blue-400",
  tsx: "bg-blue-500/20 text-blue-400",
  jsx: "bg-blue-400/20 text-blue-300",
  go: "bg-cyan-500/20 text-cyan-400",
  java: "bg-orange-500/20 text-orange-400",
  cpp: "bg-purple-500/20 text-purple-400",
  c: "bg-gray-500/20 text-gray-400",
  rust: "bg-orange-600/20 text-orange-400",
  ruby: "bg-red-500/20 text-red-400",
  php: "bg-indigo-500/20 text-indigo-400",
  markdown: "bg-gray-400/20 text-gray-300",
  json: "bg-green-500/20 text-green-400",
  yaml: "bg-pink-500/20 text-pink-400",
  text: "bg-gray-500/20 text-gray-400",
}

function langColor(lang: string) {
  return LANG_COLORS[lang] || "bg-gray-500/20 text-gray-400"
}

interface ActionItem {
  type: "action"
  id: string
  label: string
  shortcut: string
  icon: React.ReactNode
  onActivate: () => void
}

interface FileItem {
  type: "file"
  id: string
  file: IndexedFile
}

type PaletteItem = ActionItem | FileItem

export default function CommandPalette({
  files,
  onClose,
  onNavigate,
  onAskQuestion,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const actions: ActionItem[] = [
    {
      type: "action",
      id: "nav-ask",
      label: "Navigate to Ask",
      shortcut: "⌘1",
      icon: <IconMessageCircle size={14} className="text-cm-accent" />,
      onActivate: () => {
        onNavigate("ask")
        onClose()
      },
    },
    {
      type: "action",
      id: "nav-search",
      label: "Navigate to Search",
      shortcut: "⌘2",
      icon: <IconSearch size={14} className="text-cm-accent" />,
      onActivate: () => {
        onNavigate("search")
        onClose()
      },
    },
    {
      type: "action",
      id: "nav-agent",
      label: "Navigate to Agent",
      shortcut: "⌘3",
      icon: <IconBrain size={14} className="text-cm-accent" />,
      onActivate: () => {
        onNavigate("agent")
        onClose()
      },
    },
  ]

  const filteredFiles: FileItem[] = (
    query.trim()
      ? files.filter((f) =>
          f.file_path.toLowerCase().includes(query.toLowerCase())
        )
      : files.slice(0, 8)
  ).map((f) => ({
    type: "file" as const,
    id: `file-${f.file_path}`,
    file: f,
  }))

  const filteredActions: ActionItem[] = query.trim()
    ? actions.filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase())
      )
    : actions

  // Build flat list for keyboard navigation
  const items: PaletteItem[] = [...filteredActions, ...filteredFiles]

  // Clamp selectedIndex when items change
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(items.length - 1, 0)))
  }, [items.length])

  const activateItem = useCallback(
    (item: PaletteItem) => {
      if (item.type === "action") {
        item.onActivate()
      } else {
        // File selected — if query matches and user hits enter, ask about it
        onAskQuestion(`Tell me about ${item.file.file_path}`)
        onNavigate("ask")
        onClose()
      }
    },
    [onAskQuestion, onNavigate, onClose]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter") {
        e.preventDefault()
        const item = items[selectedIndex]
        if (item) activateItem(item)
      }
    },
    [items, selectedIndex, activateItem, onClose]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-palette-index="${selectedIndex}"]`
    )
    el?.scrollIntoView({ block: "nearest" })
  }, [selectedIndex])

  // Section offsets for rendering with section headers
  const actionCount = filteredActions.length
  const hasFiles = filteredFiles.length > 0
  const hasActions = filteredActions.length > 0

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Dialog */}
      <div
        className="w-full max-w-xl animate-fadeIn overflow-hidden rounded-xl border border-cm-border bg-cm-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-cm-border px-4 py-3">
          <IconSearch size={16} className="shrink-0 text-cm-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search files, actions..."
            className="flex-1 bg-transparent text-sm text-cm-text placeholder:text-cm-text-muted focus:outline-none"
          />
          <kbd className="rounded border border-cm-border px-1.5 py-0.5 text-[10px] text-cm-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-1"
        >
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-cm-text-muted">
              No results found
            </div>
          )}

          {/* Actions section */}
          {hasActions && (
            <>
              <div className="px-4 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                  Actions
                </span>
              </div>
              {filteredActions.map((item, idx) => (
                <button
                  key={item.id}
                  data-palette-index={idx}
                  onClick={() => activateItem(item)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedIndex === idx
                      ? "bg-cm-accent/15 text-cm-text"
                      : "text-cm-text-secondary hover:bg-cm-card"
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 text-xs">{item.label}</span>
                  <kbd className="rounded border border-cm-border px-1.5 py-0.5 text-[9px] text-cm-text-muted">
                    {item.shortcut}
                  </kbd>
                </button>
              ))}
            </>
          )}

          {/* Files section */}
          {hasFiles && (
            <>
              <div className="mt-1 px-4 py-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                  Files
                </span>
              </div>
              {filteredFiles.map((item, relIdx) => {
                const absIdx = actionCount + relIdx
                const parts = item.file.file_path.split("/")
                const filename = parts[parts.length - 1]
                const folder =
                  parts.length > 1
                    ? parts.slice(0, -1).join("/") + "/"
                    : null

                return (
                  <button
                    key={item.id}
                    data-palette-index={absIdx}
                    onClick={() => activateItem(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedIndex === absIdx
                        ? "bg-cm-accent/15 text-cm-text"
                        : "text-cm-text-secondary hover:bg-cm-card"
                    }`}
                  >
                    <IconFile size={14} className="shrink-0 text-cm-text-muted" />
                    <span className="flex-1 truncate text-xs">
                      {folder && (
                        <span className="text-cm-text-muted">{folder}</span>
                      )}
                      {filename}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`h-4 px-1.5 text-[9px] font-normal ${langColor(item.file.language)}`}
                    >
                      {item.file.language}
                    </Badge>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-cm-border px-4 py-2">
          <span className="text-[10px] text-cm-text-muted">
            <kbd className="rounded border border-cm-border px-1 py-0.5 text-[9px]">↑↓</kbd>{" "}
            navigate
          </span>
          <span className="text-[10px] text-cm-text-muted">
            <kbd className="rounded border border-cm-border px-1 py-0.5 text-[9px]">↵</kbd>{" "}
            select
          </span>
          <span className="text-[10px] text-cm-text-muted">
            <kbd className="rounded border border-cm-border px-1 py-0.5 text-[9px]">ESC</kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  )
}
