"use client"

import React, { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { IconChevronDown, IconChevronRight, IconFile, IconFolder } from "@tabler/icons-react"

interface IndexedFile {
  file_path: string
  language: string
}

interface FileTreeProps {
  files: IndexedFile[]
  selectedFile: string | null
  onFileSelect: (f: IndexedFile) => void
  searchQuery: string
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

interface FolderNode {
  type: "folder"
  name: string
  fullPath: string
  children: TreeNode[]
  fileCount: number
}

interface FileNode {
  type: "file"
  file: IndexedFile
  filename: string
}

type TreeNode = FolderNode | FileNode

function buildTree(files: IndexedFile[]): TreeNode[] {
  const root: TreeNode[] = []
  const folderMap = new Map<string, FolderNode>()

  const getOrCreateFolder = (parts: string[], upTo: number): FolderNode => {
    const fullPath = parts.slice(0, upTo + 1).join("/")
    if (folderMap.has(fullPath)) return folderMap.get(fullPath)!

    const folder: FolderNode = {
      type: "folder",
      name: parts[upTo],
      fullPath,
      children: [],
      fileCount: 0,
    }
    folderMap.set(fullPath, folder)

    if (upTo === 0) {
      root.push(folder)
    } else {
      const parent = getOrCreateFolder(parts, upTo - 1)
      parent.children.push(folder)
    }
    return folder
  }

  for (const file of files) {
    const parts = file.file_path.split("/")
    if (parts.length === 1) {
      // Root-level file
      root.push({ type: "file", file, filename: parts[0] })
    } else {
      // File in a directory — create folder chain up to second-to-last segment
      const folderDepth = parts.length - 2
      const folder = getOrCreateFolder(parts, folderDepth)
      const fileNode: FileNode = {
        type: "file",
        file,
        filename: parts[parts.length - 1],
      }
      folder.children.push(fileNode)
    }
  }

  // Compute file counts recursively
  function countFiles(node: TreeNode): number {
    if (node.type === "file") return 1
    let count = 0
    for (const child of node.children) {
      count += countFiles(child)
    }
    node.fileCount = count
    return count
  }
  for (const node of root) countFiles(node)

  return root
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes
  const lq = query.toLowerCase()

  const filterNodes = (ns: TreeNode[]): TreeNode[] => {
    const result: TreeNode[] = []
    for (const node of ns) {
      if (node.type === "file") {
        if (node.file.file_path.toLowerCase().includes(lq)) {
          result.push(node)
        }
      } else {
        const filteredChildren = filterNodes(node.children)
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren })
        }
      }
    }
    return result
  }
  return filterNodes(nodes)
}

function FolderRow({
  folder,
  expanded,
  onToggle,
}: {
  folder: FolderNode
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-cm-text-secondary transition-colors hover:bg-cm-card hover:text-cm-text"
    >
      <span className="shrink-0 text-cm-text-muted">
        {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
      </span>
      <IconFolder size={13} className="shrink-0 text-cm-yellow" />
      <span className="flex-1 truncate text-[11px] font-medium">{folder.name}</span>
      <span className="rounded bg-cm-bg px-1 text-[9px] text-cm-text-muted">
        {folder.fileCount}
      </span>
    </button>
  )
}

function FileRow({
  node,
  selected,
  onSelect,
  indent,
}: {
  node: FileNode
  selected: boolean
  onSelect: () => void
  indent: number
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left transition-colors ${
        selected
          ? "bg-cm-accent/15 text-cm-accent"
          : "text-cm-text-secondary hover:bg-cm-card hover:text-cm-text"
      }`}
      style={{ paddingLeft: `${8 + indent * 12}px` }}
    >
      <IconFile
        size={13}
        className={`shrink-0 ${selected ? "text-cm-accent" : "text-cm-text-muted"}`}
      />
      <span className="flex-1 truncate text-[11px]">{node.filename}</span>
      <Badge
        variant="secondary"
        className={`h-4 px-1.5 text-[9px] font-normal ${langColor(node.file.language)}`}
      >
        {node.file.language}
      </Badge>
    </button>
  )
}

interface FolderTreeProps {
  nodes: TreeNode[]
  selectedFile: string | null
  onFileSelect: (f: IndexedFile) => void
  defaultOpen: boolean
  indent: number
}

function FolderTree({
  nodes,
  selectedFile,
  onFileSelect,
  defaultOpen,
  indent,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const node of nodes) {
      if (node.type === "folder") {
        init[node.fullPath] = defaultOpen
      }
    }
    return init
  })

  const toggle = (path: string) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => {
        if (node.type === "file") {
          return (
            <FileRow
              key={node.file.file_path}
              node={node}
              selected={selectedFile === node.file.file_path}
              onSelect={() => onFileSelect(node.file)}
              indent={indent}
            />
          )
        } else {
          const isOpen = expanded[node.fullPath] ?? defaultOpen
          return (
            <div key={node.fullPath}>
              <div style={{ paddingLeft: `${indent * 12}px` }}>
                <FolderRow
                  folder={node}
                  expanded={isOpen}
                  onToggle={() => toggle(node.fullPath)}
                />
              </div>
              {isOpen && node.children.length > 0 && (
                <FolderTree
                  nodes={node.children}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                  defaultOpen={defaultOpen}
                  indent={indent + 1}
                />
              )}
            </div>
          )
        }
      })}
    </div>
  )
}

export default function FileTree({
  files,
  selectedFile,
  onFileSelect,
  searchQuery,
}: FileTreeProps) {
  const tree = useMemo(() => buildTree(files), [files])
  const filtered = useMemo(
    () => filterTree(tree, searchQuery),
    [tree, searchQuery]
  )

  // Count top-level folders in original tree
  const folderCount = useMemo(
    () => tree.filter((n) => n.type === "folder").length,
    [tree]
  )

  // Default expand if ≤3 folders
  const defaultOpen = folderCount <= 3

  if (files.length === 0) return null

  return (
    <div className="space-y-0.5 px-2">
      <FolderTree
        nodes={filtered}
        selectedFile={selectedFile}
        onFileSelect={onFileSelect}
        defaultOpen={defaultOpen}
        indent={0}
      />
    </div>
  )
}
