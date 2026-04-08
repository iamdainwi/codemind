"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  IconMessageCircle,
  IconSearch,
  IconBrain,
  IconLogout,
  IconFile,
  IconRefresh,
} from "@tabler/icons-react";
import UploadPanel from "@/components/UploadPanel";
import ChatPanel from "@/components/ChatPanel";
import SearchPanel from "@/components/SearchPanel";
import AgentPanel from "@/components/AgentPanel";
import FileTree from "@/components/FileTree";
import { useAuth, getAuthHeaders } from "@/lib/auth";
import { FileIcon } from "next/dist/next-devtools/dev-overlay/icons/file"
import EditorPanel from "@/components/EditorPanel"

interface IndexedFile {
  file_path: string;
  language: string;
}

type ActiveTab = "ask" | "search" | "agent" | "editor";

export default function DashboardPage() {
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("ask");
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string>("");
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/files", {
        headers: { ...getAuthHeaders() },
      });
      const json = await res.json();
      if (json.success && json.data?.files) {
        setFiles(json.data.files);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchFiles();
    }
  }, [fetchFiles, isAuthenticated]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      } else if (e.key === "1") {
        e.preventDefault();
        setActiveTab("ask");
      } else if (e.key === "2") {
        e.preventDefault();
        setActiveTab("search");
      } else if (e.key === "3") {
        e.preventDefault();
        setActiveTab("agent");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleFileSelect = (f: IndexedFile) => {
    setSelectedFile(f.file_path);
  };

  const handleAskQuestion = (q: string) => {
    setPendingQuestion(q);
    setActiveTab("ask");
  };

  const handlePendingConsumed = () => {
    setPendingQuestion("");
  };

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : user?.email
      ? user.email[0].toUpperCase()
      : "?";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cm-bg">
        <div className="flex items-center gap-3 text-cm-text-muted">
          <IconBrain size={20} className="animate-pulse text-cm-accent" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const TABS: { id: ActiveTab; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: "ask", label: "Ask", icon: <IconMessageCircle size={13} />, shortcut: "1" },
    { id: "search", label: "Search", icon: <IconSearch size={13} />, shortcut: "2" },
    { id: "agent", label: "Agent", icon: <IconBrain size={13} />, shortcut: "3" },
    { id: "editor", label: "Editor", icon: <IconFile size={13}/>, shortcut: "4"}
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-cm-bg">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-cm-border bg-cm-panel px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-cm-accent">
            <IconBrain size={13} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-cm-text">CodeMind</span>
        </div>

        {/* Command palette trigger — center */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="mx-auto flex items-center gap-2 rounded-md border border-cm-border bg-cm-card px-3 py-1.5 text-xs text-cm-text-muted transition hover:border-cm-text-muted hover:text-cm-text"
        >
          <IconSearch size={12} />
          <span>Search files and actions...</span>
          <kbd className="rounded border border-cm-border px-1 py-0.5 text-[9px]">
            ⌘K
          </kbd>
        </button>

        {/* Avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-md px-2 py-1 transition hover:bg-cm-card">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-cm-accent text-[11px] font-medium text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-52 border-cm-border bg-cm-panel"
          >
            <DropdownMenuLabel className="pb-1">
              <p className="text-xs font-medium text-cm-text">
                {user?.name ?? "User"}
              </p>
              <p className="text-[10px] font-normal text-cm-text-muted">
                {user?.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-cm-border" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer gap-2 text-xs text-cm-text-muted hover:text-cm-red focus:text-cm-red"
            >
              <IconLogout size={13} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="flex w-72 shrink-0 flex-col border-r border-cm-border bg-cm-panel">
          {/* UploadPanel */}
          <div className="shrink-0">
            <UploadPanel
              files={files}
              onFilesChange={fetchFiles}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
            />
          </div>

          {files.length > 0 && (
            <>
              <Separator className="bg-cm-border" />
              {/* File tree section */}
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                      Files
                    </span>
                    <Badge
                      variant="secondary"
                      className="h-4 bg-cm-card px-1.5 text-[9px] text-cm-text-muted"
                    >
                      {files.length}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-cm-text-muted hover:text-cm-text"
                    onClick={fetchFiles}
                    title="Refresh files"
                  >
                    <IconRefresh size={11} />
                  </Button>
                </div>

                {/* File search */}
                <div className="px-3 pb-2">
                  <div className="relative">
                    <IconSearch
                      size={11}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cm-text-muted"
                    />
                    <Input
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      placeholder="Filter files..."
                      className="h-7 border-cm-border bg-cm-bg pl-7 text-[11px] text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent/30"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 pb-3">
                  <FileTree
                    files={files}
                    selectedFile={selectedFile}
                    onFileSelect={handleFileSelect}
                    searchQuery={fileSearchQuery}
                  />
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        {/* Right content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Custom tab bar */}
          <div className="flex h-10 shrink-0 items-center border-b border-cm-border bg-cm-panel">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex h-10 items-center gap-1.5 border-b-2 px-4 text-xs transition-colors ${
                  activeTab === tab.id
                    ? "border-cm-accent text-cm-accent"
                    : "border-transparent text-cm-text-muted hover:text-cm-text"
                }`}
              >
                {tab.icon}
                {tab.label}
                <kbd
                  className={`ml-1 rounded border border-cm-border px-1 text-[9px] opacity-60 ${
                    activeTab === tab.id
                      ? "text-cm-accent"
                      : "text-cm-text-muted"
                  }`}
                >
                  ⌘{tab.shortcut}
                </kbd>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "ask" && (
              <ChatPanel
                pendingQuestion={pendingQuestion}
                onPendingConsumed={handlePendingConsumed}
              />
            )}
            {activeTab === "search" && <SearchPanel />}
            {activeTab === "agent" && <AgentPanel />}
            {activeTab === "editor" && <EditorPanel />}
          </div>
        </div>
      </div>

      {/* Command dialog */}
      <CommandDialog
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
      >
        <CommandInput placeholder="Search files, navigate..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem
              onSelect={() => {
                setActiveTab("ask");
                setShowCommandPalette(false);
              }}
            >
              <IconMessageCircle size={14} className="mr-2" />
              Ask
              <CommandShortcut>⌘1</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setActiveTab("search");
                setShowCommandPalette(false);
              }}
            >
              <IconSearch size={14} className="mr-2" />
              Search
              <CommandShortcut>⌘2</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setActiveTab("agent");
                setShowCommandPalette(false);
              }}
            >
              <IconBrain size={14} className="mr-2" />
              Agent
              <CommandShortcut>⌘3</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          {files.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Files">
                {files.map((f) => {
                  const parts = f.file_path.split("/");
                  const filename = parts[parts.length - 1];
                  const folder =
                    parts.length > 1
                      ? parts.slice(0, -1).join("/")
                      : null;

                  return (
                    <CommandItem
                      key={f.file_path}
                      value={f.file_path}
                      onSelect={() => {
                        handleAskQuestion(
                          `Tell me about ${f.file_path}`
                        );
                        setShowCommandPalette(false);
                      }}
                    >
                      <IconFile size={14} className="mr-2 shrink-0" />
                      {folder && (
                        <span className="text-cm-text-muted">
                          {folder}/
                        </span>
                      )}
                      <span>{filename}</span>
                      <Badge
                        variant="secondary"
                        className="ml-auto h-4 bg-cm-card px-1.5 text-[9px] text-cm-text-muted"
                      >
                        {f.language}
                      </Badge>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
