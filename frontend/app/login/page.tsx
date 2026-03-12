"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconBrain, IconLoader2, IconEye, IconEyeOff } from "@tabler/icons-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cm-bg p-4">
      {/* Gradient accent glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cm-accent/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent">
            <IconBrain size={24} className="text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-cm-text">CodeMind</h1>
          <p className="mt-1 text-sm text-cm-text-muted">
            AI-powered code knowledge base
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-cm-border bg-cm-panel p-6">
          <h2 className="text-lg font-semibold text-cm-text">
            {isRegister ? "Create account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-xs text-cm-text-muted">
            {isRegister
              ? "Sign up to start indexing your codebase"
              : "Sign in to your CodeMind account"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isRegister && (
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-cm-text-muted">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-cm-border bg-cm-card px-3 py-2.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:border-cm-accent focus:outline-none focus:ring-1 focus:ring-cm-accent"
                  required={isRegister}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-cm-text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-cm-border bg-cm-card px-3 py-2.5 text-sm text-cm-text placeholder:text-cm-text-muted focus:border-cm-accent focus:outline-none focus:ring-1 focus:ring-cm-accent"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-cm-text-muted">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-cm-border bg-cm-card px-3 py-2.5 pr-10 text-sm text-cm-text placeholder:text-cm-text-muted focus:border-cm-accent focus:outline-none focus:ring-1 focus:ring-cm-accent"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cm-text-muted hover:text-cm-text"
                >
                  {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-cm-red/10 px-3 py-2 text-xs text-cm-red">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-cm-accent py-2.5 text-sm font-medium hover:bg-cm-accent-dim"
              disabled={loading}
            >
              {loading ? (
                <IconLoader2 size={16} className="animate-spin" />
              ) : isRegister ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-xs text-cm-text-muted hover:text-cm-accent transition-colors"
            >
              {isRegister
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[10px] text-cm-text-muted">
          Powered by Endee Vector Database
        </p>
      </div>
    </div>
  );
}
