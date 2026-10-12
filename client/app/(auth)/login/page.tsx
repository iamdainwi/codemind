"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api/auth";
import {
  Terminal,
  Lock,
  User,
  Eye,
  EyeOff,
  Cpu,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fn = mode === "login" ? login : register;
      const res = await fn(username, password);
      if (!res.success) {
        setError(res.error?.message ?? "Authentication failed. Please verify credentials.");
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Network error. Verify the backend service is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden select-none">
      {/* Subtle background ambient glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-violet-600/15 via-indigo-500/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(oklch(1_0_0_/_3%)_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="size-11 rounded-xl bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/25 ring-1 ring-white/10">
            <Terminal className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">CodeMind</span>
            <span className="px-1.5 py-0.5 rounded-sm bg-violet-500/10 text-violet-400 text-[10px] font-mono border border-violet-500/20">
              AST RAG
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs">
            Locally-deployed framework for codebase question answering and AST retrieval.
          </p>
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xl p-6 shadow-2xl space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 rounded-lg bg-muted/50 p-1 border border-border/60 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === "login"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-1.5 rounded-md transition-all ${
                mode === "register"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs font-medium text-foreground"
              >
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="developer_id"
                  className="w-full pl-9 pr-3.5 py-2 rounded-lg bg-background/80 border border-border/80 text-foreground placeholder:text-muted-foreground/60 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all font-mono"
                />
                <User className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-medium text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-9 py-2 rounded-lg bg-background/80 border border-border/80 text-foreground placeholder:text-muted-foreground/60 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all font-mono"
                />
                <Lock className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                {error}
              </div>
            )}

            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-violet-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating…</span>
              ) : mode === "login" ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="size-3.5" />
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Feature Pills */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 font-mono">
          <span className="flex items-center gap-1">
            <Shield className="size-3 text-emerald-400" />
            100% Local Inference
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Cpu className="size-3 text-violet-400" />
            Tree-sitter AST
          </span>
        </div>

        {/* Subtle Deerflow Signature */}
        <a
          href="https://deerflow.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors font-mono"
        >
          <span>✦ Created by Deerflow</span>
        </a>
      </div>
    </main>
  );
}
