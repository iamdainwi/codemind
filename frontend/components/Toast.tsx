"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import { IconCheck, IconInfoCircle, IconX } from "@tabler/icons-react"

type ToastKind = "success" | "error" | "info"

interface ToastItem {
  id: string
  message: string
  kind: ToastKind
  visible: boolean
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within a ToastProvider")
  return ctx
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cm-green/20">
        <IconCheck size={12} className="text-cm-green" />
      </span>
    )
  }
  if (kind === "error") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cm-red/20">
        <IconX size={12} className="text-cm-red" />
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cm-accent/20">
      <IconInfoCircle size={12} className="text-cm-accent" />
    </span>
  )
}

function ToastEntry({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border border-cm-border bg-cm-panel px-4 py-3 shadow-xl transition-all duration-200 ${
        item.visible
          ? "animate-slideInBottom opacity-100 translate-y-0"
          : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      role="alert"
    >
      <ToastIcon kind={item.kind} />
      <span className="flex-1 text-xs text-cm-text">{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-cm-text-muted transition-colors hover:text-cm-text"
        aria-label="Dismiss"
      >
        <IconX size={12} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counterRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    // Mark as not visible first for fade-out, then remove
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 250)
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      counterRef.current += 1
      const id = `toast-${counterRef.current}`
      const item: ToastItem = { id, message, kind, visible: false }

      setToasts((prev) => {
        // Max 5 visible
        const next = [...prev, item].slice(-5)
        return next
      })

      // Trigger slide-in after mount
      requestAnimationFrame(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: true } : t))
        )
      })

      // Auto-dismiss after 4s
      setTimeout(() => dismiss(id), 4000)
    },
    [dismiss]
  )

  // Clean up stale invisible toasts
  useEffect(() => {
    const interval = setInterval(() => {
      setToasts((prev) => prev.filter((t) => t.visible))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast portal — fixed bottom-right */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2"
        style={{ minWidth: 300, maxWidth: 420 }}
      >
        {toasts.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastEntry item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
