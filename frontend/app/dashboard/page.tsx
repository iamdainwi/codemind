"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  IconMessageCircle,
  IconSearch,
  IconBrain,
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import UploadPanel from "@/components/UploadPanel";
import ChatPanel from "@/components/ChatPanel";
import SearchPanel from "@/components/SearchPanel";
import AgentPanel from "@/components/AgentPanel";
import FileCard from "@/components/FileCard";
import { useAuth, getAuthHeaders } from "@/lib/auth";

interface IndexedFile {
  file_path: string;
  language: string;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<IndexedFile | null>(null);
  const [activeTab, setActiveTab] = useState("ask");
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  // Redirect to login if not authenticated
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
    if (isAuthenticated) {
      fetchFiles();
    }
  }, [fetchFiles, isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-cm-bg">
      {/* Left Panel — Upload + Files */}
      <div className="flex w-80 shrink-0 flex-col border-r border-cm-border bg-cm-panel">
        <UploadPanel
          files={files}
          onFilesChange={fetchFiles}
          onFileSelect={(f) => setSelectedFile(f)}
          selectedFile={selectedFile?.file_path ?? null}
        />

        {/* User footer */}
        <div className="border-t border-cm-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cm-accent/15">
              <IconUser size={14} className="text-cm-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium text-cm-text">
                {user?.name || "User"}
              </p>
              <p className="truncate text-[10px] text-cm-text-muted">
                {user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-cm-text-muted hover:text-cm-red"
              onClick={handleLogout}
            >
              <IconLogout size={14} />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel — Tabs */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* File Recommendations bar */}
        {selectedFile && (
          <div className="border-b border-cm-border bg-cm-panel p-3">
            <FileCard
              filePath={selectedFile.file_path}
              language={selectedFile.language}
            />
          </div>
        )}

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="border-b border-cm-border bg-cm-panel">
            <TabsList className="h-10 w-full justify-start gap-0 rounded-none border-0 bg-transparent p-0">
              <TabsTrigger
                value="ask"
                className="relative h-10 rounded-none border-b-2 border-transparent px-4 text-xs text-cm-text-muted transition-colors hover:text-cm-text data-[state=active]:border-cm-accent data-[state=active]:bg-transparent data-[state=active]:text-cm-accent data-[state=active]:shadow-none"
              >
                <IconMessageCircle size={14} className="mr-1.5" />
                Ask
              </TabsTrigger>
              <TabsTrigger
                value="search"
                className="relative h-10 rounded-none border-b-2 border-transparent px-4 text-xs text-cm-text-muted transition-colors hover:text-cm-text data-[state=active]:border-cm-accent data-[state=active]:bg-transparent data-[state=active]:text-cm-accent data-[state=active]:shadow-none"
              >
                <IconSearch size={14} className="mr-1.5" />
                Search
              </TabsTrigger>
              <TabsTrigger
                value="agent"
                className="relative h-10 rounded-none border-b-2 border-transparent px-4 text-xs text-cm-text-muted transition-colors hover:text-cm-text data-[state=active]:border-cm-accent data-[state=active]:bg-transparent data-[state=active]:text-cm-accent data-[state=active]:shadow-none"
              >
                <IconBrain size={14} className="mr-1.5" />
                Agent
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="ask" className="mt-0 flex-1 overflow-hidden">
            <ChatPanel />
          </TabsContent>

          <TabsContent value="search" className="mt-0 flex-1 overflow-hidden">
            <SearchPanel />
          </TabsContent>

          <TabsContent value="agent" className="mt-0 flex-1 overflow-hidden">
            <AgentPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
