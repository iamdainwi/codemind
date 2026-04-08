"use client"

import React, { useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { IconCheck, IconCopy } from "@tabler/icons-react"

interface CodeBlockProps {
  language: string
  code: string
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available in some environments — silently ignore
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-md border border-cm-border">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-cm-card px-3 py-1.5">
        <span className="text-[10px] font-medium text-cm-text-muted">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-cm-text-muted transition-colors hover:bg-cm-card-hover hover:text-cm-text"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <IconCheck size={11} className="text-cm-green" />
              <span className="text-cm-green">Copied!</span>
            </>
          ) : (
            <>
              <IconCopy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        showLineNumbers
        lineNumberStyle={{ color: "#3f3f46", fontSize: "10px", minWidth: "2em" }}
        customStyle={{
          margin: 0,
          padding: "12px",
          background: "#0d0d0d",
          fontSize: "12px",
          lineHeight: "1.6",
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
