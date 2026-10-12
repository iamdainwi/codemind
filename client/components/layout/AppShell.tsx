"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { useState } from "react";
import { LayoutDashboard, BarChart3, Database, LogOut, Terminal, Cpu } from "lucide-react";

interface AppShellProps {
  children: React.ReactNode;
  username?: string;
}

const NAV = [
  { href: "/dashboard", label: "Repositories", icon: LayoutDashboard },
  { href: "/eval", label: "Evaluation", icon: BarChart3 },
];

export default function AppShell({ children, username }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 shrink-0 border-r border-border/80 bg-card/40 backdrop-blur-xl">
        {/* Logo & Brand Header */}
        <div className="flex flex-col gap-1 px-5 py-5 border-b border-border/70">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-md shadow-violet-500/20 ring-1 ring-white/10">
              <Terminal className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-foreground flex items-center gap-1.5">
                CodeMind
                <span className="px-1.5 py-0.2 rounded-xs bg-violet-500/10 text-violet-400 text-[10px] font-mono border border-violet-500/20">
                  AST
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                Codebase Q&A RAG
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Workspace
          </div>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group ${
                  active
                    ? "bg-violet-500/10 text-violet-300 border border-violet-500/20 shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-4 transition-colors ${
                    active ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span className="flex-1">{label}</span>
                {active && (
                  <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
                )}
              </Link>
            );
          })}

          <div className="pt-6 px-2 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Local Engine
          </div>
          <div className="mx-1 p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Cpu className="size-3 text-cyan-400" />
                <span>Ollama LLM</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <span className="size-1 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Database className="size-3 text-violet-400" />
                <span>ChromaDB</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                <span className="size-1 rounded-full bg-emerald-400" />
                Ready
              </span>
            </div>
          </div>
        </nav>

        {/* Footer & User Profile */}
        <div className="p-3 border-t border-border/70 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-muted/30 border border-border/40">
            <div className="size-7 rounded-full bg-gradient-to-br from-violet-600 to-cyan-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 ring-1 ring-white/10">
              {username?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">
                {username ?? "User"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate font-mono">
                Local Session
              </div>
            </div>
            <button
              id="logout-btn"
              onClick={handleLogout}
              disabled={signingOut}
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted/60"
            >
              <LogOut className="size-3.5" />
            </button>
          </div>

          {/* Deerflow Signature */}
          <div className="text-center pt-1">
            <a
              href="https://deerflow.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors font-mono"
            >
              <span>✦ Created by Deerflow</span>
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-background/50">
        {children}
      </main>
    </div>
  );
}
