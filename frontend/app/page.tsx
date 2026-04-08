"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  IconBrain,
  IconSearch,
  IconMessageCircle,
  IconBulb,
  IconArrowRight,
  IconCode,
  IconDatabase,
  IconCpu,
  IconRocket,
  IconBrandGithub,
  IconUpload,
  IconSparkles,
} from "@tabler/icons-react";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  {
    icon: IconMessageCircle,
    title: "RAG Chat",
    description:
      "Ask questions about your code in plain English and get cited answers grounded in your actual source code.",
    color: "from-blue-500/20 to-blue-600/5",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: IconSearch,
    title: "Semantic Search",
    description:
      "Describe what you are looking for by meaning, not keywords. Find the exact code snippet you need instantly.",
    color: "from-emerald-500/20 to-emerald-600/5",
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: IconBrain,
    title: "Agentic Q&A",
    description:
      "Complex questions are automatically decomposed, multi-searched, and synthesized into comprehensive answers.",
    color: "from-purple-500/20 to-purple-600/5",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: IconBulb,
    title: "File Recommendations",
    description:
      "Select any file and discover similar files across your codebase using vector similarity.",
    color: "from-amber-500/20 to-amber-600/5",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
  },
];

const HOW_IT_WORKS = [
  {
    number: "01",
    icon: IconUpload,
    title: "Upload",
    description:
      "Drag-drop files or ZIP, or connect GitHub for private repos. Any language, any structure.",
  },
  {
    number: "02",
    icon: IconDatabase,
    title: "Index",
    description:
      "Files are chunked, embedded with SentenceTransformer, and stored in Endee vector DB for instant retrieval.",
  },
  {
    number: "03",
    icon: IconSparkles,
    title: "Ask",
    description:
      "Query in plain English, get answers with source citations. Every answer traces back to your code.",
  },
];

const TECH_STACK = [
  "Endee Vector DB",
  "Ollama LLM",
  "FastAPI",
  "Next.js 15",
  "SentenceTransformer",
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
      {/* Sticky Nav */}
      <nav className="sticky top-0 z-50 border-b border-cm-border/50 bg-cm-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cm-accent">
              <IconBrain size={15} className="text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">CodeMind</span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {["Ask", "Search", "Agent"].map((item) => (
              <Link
                key={item}
                href="/login"
                className="text-sm text-cm-text-muted transition-colors hover:text-cm-text"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-cm-text-muted hover:text-cm-text"
              >
                Sign in
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-cm-accent text-xs hover:bg-cm-accent-dim"
              >
                Get started
                <IconArrowRight size={12} className="ml-1" />
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

        <div className="relative mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
          <Badge
            variant="outline"
            className="mb-6 border-cm-border bg-cm-card/50 px-4 py-1.5 text-xs text-cm-text-muted"
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cm-green animate-pulse" />
            Open source · Self-hosted · Privacy first
          </Badge>

          <h1 className="text-6xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            Your codebase,
            <br />
            <span className="bg-gradient-to-r from-cm-accent via-blue-400 to-purple-400 bg-clip-text text-transparent">
              answered.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-cm-text-secondary">
            Upload any codebase. Ask anything. Get cited answers in seconds —
            powered by local AI and vector search.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/login">
              <Button
                size="lg"
                className="h-11 bg-cm-accent px-8 text-sm font-medium hover:bg-cm-accent-dim"
              >
                Start for free →
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
                className="h-11 border-cm-border bg-transparent text-sm text-cm-text-secondary hover:bg-cm-card hover:text-cm-text"
              >
                <IconBrandGithub size={15} className="mr-1.5" />
                View on GitHub
              </Button>
            </a>
          </div>

          {/* Terminal mockup */}
          <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-xl border border-cm-border bg-cm-panel shadow-2xl shadow-black/50">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-cm-border bg-cm-card px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-cm-red/70" />
              <span className="h-3 w-3 rounded-full bg-cm-yellow/70" />
              <span className="h-3 w-3 rounded-full bg-cm-green/70" />
              <span className="ml-3 flex-1 text-center font-mono text-[11px] text-cm-text-muted">
                codemind — ask
              </span>
            </div>
            {/* Body */}
            <div className="space-y-4 p-5 font-mono text-sm">
              {/* User message */}
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-br-sm bg-cm-card px-4 py-2.5">
                  <p className="text-sm text-cm-text">
                    How does authentication work?
                  </p>
                </div>
              </div>
              {/* Assistant message */}
              <div className="space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-cm-text-muted">
                  CodeMind
                </p>
                <p className="text-left text-sm leading-relaxed text-cm-text-secondary">
                  Authentication uses{" "}
                  <span className="rounded bg-cm-card px-1.5 py-0.5 text-xs text-cm-accent">
                    JWT tokens (HS256)
                  </span>{" "}
                  with a 7-day expiry. The{" "}
                  <span className="rounded bg-cm-card px-1.5 py-0.5 text-xs text-cm-accent">
                    AuthMiddleware
                  </span>{" "}
                  validates every protected route, extracting the user ID from
                  the token payload.
                </p>
                {/* Sources */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cm-border bg-cm-card/50 px-2.5 py-0.5 text-[10px] text-cm-text-muted">
                    <IconCode size={10} className="text-cm-accent" />
                    auth.py
                    <span className="font-mono text-cm-green">94%</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cm-border bg-cm-card/50 px-2.5 py-0.5 text-[10px] text-cm-text-muted">
                    <IconCode size={10} className="text-cm-accent" />
                    middleware.py
                    <span className="font-mono text-cm-yellow">81%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-cm-border/50 bg-cm-panel/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Four ways to explore your code
            </h2>
            <p className="mt-3 text-sm text-cm-text-muted">
              Every feature is powered by Endee vector database for
              lightning-fast semantic operations
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="group relative overflow-hidden border-cm-border bg-cm-card/50 transition-all hover:border-cm-text-muted/30 hover:shadow-lg hover:shadow-cm-accent/5"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <CardContent className="relative p-6">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border ${f.iconBg}`}
                  >
                    <f.icon size={20} className={f.iconColor} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-cm-text">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cm-text-muted">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-cm-border/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Up and running in minutes
            </h2>
            <p className="mt-3 text-sm text-cm-text-muted">
              Three steps from zero to answered
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map((step) => (
              <div key={step.number} className="relative flex flex-col">
                {/* Connector line */}
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cm-border bg-cm-card">
                    <step.icon size={18} className="text-cm-accent" />
                  </div>
                  <span className="font-mono text-4xl font-bold text-cm-border">
                    {step.number}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-cm-text">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cm-text-muted">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="border-t border-cm-border/50 bg-cm-panel/30">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="mr-4 text-xs text-cm-text-muted">
              Built with
            </span>
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center gap-1.5 rounded-full border border-cm-border bg-cm-card px-3.5 py-1.5 text-xs text-cm-text-secondary transition-colors hover:border-cm-text-muted hover:text-cm-text"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-cm-border/50">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent/10 border border-cm-accent/20">
              <IconRocket size={22} className="text-cm-accent" />
            </div>
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to understand your codebase?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-cm-text-muted">
            Sign up in seconds. Upload a ZIP. Start asking. No cloud required —
            runs entirely on your machine.
          </p>
          <div className="mt-10">
            <Link href="/login">
              <Button
                size="lg"
                className="h-12 bg-cm-accent px-10 text-sm font-medium hover:bg-cm-accent-dim"
              >
                Get started free
                <IconArrowRight size={15} className="ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cm-border/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cm-accent">
                <IconBrain size={12} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-cm-text">
                CodeMind
              </span>
              <span className="text-xs text-cm-text-muted">·</span>
              <span className="text-xs text-cm-text-muted">
                Built for developers
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cm-text-muted transition-colors hover:text-cm-text"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-xs text-cm-text-muted transition-colors hover:text-cm-text"
              >
                Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
