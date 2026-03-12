"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  IconBrain,
  IconSearch,
  IconMessageCircle,
  IconBulb,
  IconArrowRight,
  IconCode,
  IconDatabase,
  IconCpu,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  {
    icon: IconMessageCircle,
    title: "RAG Chat",
    description: "Ask questions about your code in plain English and get cited answers grounded in your actual source code.",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
  },
  {
    icon: IconSearch,
    title: "Semantic Search",
    description: "Describe what you are looking for by meaning, not keywords. Find the exact code snippet you need instantly.",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
  },
  {
    icon: IconBulb,
    title: "Smart Recommendations",
    description: "Select any file and discover similar files across your codebase using vector similarity.",
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
  },
  {
    icon: IconBrain,
    title: "Agentic Q&A",
    description: "Complex questions are automatically decomposed, multi-searched, and synthesized into comprehensive answers.",
    color: "from-purple-500/20 to-purple-600/5",
    iconColor: "text-purple-400",
  },
];

const TECH = [
  { icon: IconDatabase, label: "Endee Vector DB", desc: "Core storage & search" },
  { icon: IconCpu, label: "Ollama LLM", desc: "Local AI inference" },
  { icon: IconCode, label: "FastAPI + Next.js", desc: "Full-stack framework" },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-cm-bg text-cm-text">
      {/* Nav */}
      <nav className="border-b border-cm-border/50 bg-cm-bg/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cm-accent">
              <IconBrain size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold">CodeMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button
                variant="ghost"
                className="text-sm text-cm-text-muted hover:text-cm-text"
              >
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-cm-accent text-sm hover:bg-cm-accent-dim">
                Get started
                <IconArrowRight size={14} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Gradient blobs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[900px] rounded-full bg-cm-accent/8 blur-[150px]" />
        <div className="pointer-events-none absolute top-40 -left-40 h-[400px] w-[400px] rounded-full bg-purple-500/5 blur-[120px]" />
        <div className="pointer-events-none absolute top-60 -right-40 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-[120px]" />

        <div className="relative mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cm-border bg-cm-card/50 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cm-green animate-pulse" />
            <span className="text-xs text-cm-text-muted">
              Powered by Endee Vector Database
            </span>
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Your codebase,{" "}
            <span className="bg-gradient-to-r from-cm-accent to-purple-400 bg-clip-text text-transparent">
              understood.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-cm-text-secondary">
            Upload your code, ask questions in plain English, and get cited answers.
            CodeMind uses AI to semantically index every file, enabling instant search,
            smart recommendations, and deep agentic analysis.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-cm-accent px-8 text-base font-medium hover:bg-cm-accent-dim h-12"
              >
                Start for free
                <IconArrowRight size={16} className="ml-1.5" />
              </Button>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                size="lg"
                className="border-cm-border text-base text-cm-text-secondary hover:bg-cm-card h-12"
              >
                <IconCode size={16} className="mr-1.5" />
                View source
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-cm-border/50 bg-cm-panel/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold">
              Four ways to explore your code
            </h2>
            <p className="mt-3 text-sm text-cm-text-muted">
              Every feature is powered by Endee vector database for lightning-fast semantic operations
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-xl border border-cm-border bg-cm-card/50 p-6 transition-all hover:border-cm-text-muted/30 hover:shadow-lg hover:shadow-cm-accent/5"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cm-bg border border-cm-border">
                    <f.icon size={20} className={f.iconColor} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-cm-text">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cm-text-muted">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="border-t border-cm-border/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold">Built with the best</h2>
            <p className="mt-3 text-sm text-cm-text-muted">
              Modern stack designed for speed, privacy, and local-first AI
            </p>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
            {TECH.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-3 rounded-xl border border-cm-border bg-cm-card/50 px-5 py-3.5"
              >
                <t.icon size={20} className="text-cm-accent" />
                <div>
                  <p className="text-sm font-medium text-cm-text">{t.label}</p>
                  <p className="text-[11px] text-cm-text-muted">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-cm-border/50 bg-cm-panel/30">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">
            Ready to understand your codebase?
          </h2>
          <p className="mt-4 text-sm text-cm-text-muted">
            Sign up in seconds. Upload a ZIP. Start asking.
          </p>
          <div className="mt-8">
            <Link href="/login">
              <Button
                size="lg"
                className="bg-cm-accent px-10 text-base font-medium hover:bg-cm-accent-dim h-12"
              >
                Get started — it&apos;s free
                <IconArrowRight size={16} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cm-border/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cm-accent">
                <IconBrain size={12} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-cm-text-muted">
                CodeMind
              </span>
            </div>
            <p className="text-[11px] text-cm-text-muted">
              Built for Endee.io campus evaluation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
