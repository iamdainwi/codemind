"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IconBrain,
  IconBrandGithub,
  IconLoader2,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleGithubLogin = async () => {
    setGithubLoading(true);
    setError("");
    try {
      const res = await fetch("/api/github/login");
      const json = await res.json();
      if (json.success && json.data?.oauth_url) {
        window.location.href = json.data.oauth_url;
      } else {
        setError(json.error || "GitHub login is not configured");
        setGithubLoading(false);
      }
    } catch (e) {
      setError(String(e));
      setGithubLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (activeTab === "signup") {
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
      {/* Background glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-cm-accent/5 blur-[120px]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent">
            <IconBrain size={24} className="text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-cm-text">CodeMind</h1>
          <p className="mt-1 text-xs text-cm-text-muted">
            AI-powered code knowledge base
          </p>
        </div>

        <Card className="border-cm-border bg-cm-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-cm-text">
              {activeTab === "login" ? "Welcome back" : "Create account"}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* GitHub OAuth */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-cm-border bg-cm-card text-sm text-cm-text hover:bg-cm-card-hover hover:text-cm-text"
              onClick={handleGithubLogin}
              disabled={githubLoading || loading}
            >
              {githubLoading ? (
                <IconLoader2 size={15} className="animate-spin" />
              ) : (
                <IconBrandGithub size={15} />
              )}
              Continue with GitHub
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <Separator className="flex-1 bg-cm-border" />
              <span className="text-[10px] text-cm-text-muted">
                or continue with email
              </span>
              <Separator className="flex-1 bg-cm-border" />
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as "login" | "signup");
                setError("");
              }}
            >
              <TabsList className="w-full bg-cm-card border border-cm-border">
                <TabsTrigger
                  value="login"
                  className="flex-1 text-xs data-[state=active]:bg-cm-accent data-[state=active]:text-white"
                >
                  Sign in
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="flex-1 text-xs data-[state=active]:bg-cm-accent data-[state=active]:text-white"
                >
                  Sign up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="login-email"
                      className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted"
                    >
                      Email
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="border-cm-border bg-cm-card text-sm text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="login-password"
                      className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="border-cm-border bg-cm-card pr-10 text-sm text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cm-text-muted hover:text-cm-text"
                      >
                        {showPw ? (
                          <IconEyeOff size={15} />
                        ) : (
                          <IconEye size={15} />
                        )}
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
                    className="w-full bg-cm-accent text-sm font-medium hover:bg-cm-accent-dim"
                    disabled={loading}
                  >
                    {loading ? (
                      <IconLoader2 size={15} className="animate-spin" />
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-name"
                      className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted"
                    >
                      Name
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      required
                      className="border-cm-border bg-cm-card text-sm text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-email"
                      className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted"
                    >
                      Email
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="border-cm-border bg-cm-card text-sm text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="signup-password"
                      className="text-[11px] font-medium uppercase tracking-wider text-cm-text-muted"
                    >
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="border-cm-border bg-cm-card pr-10 text-sm text-cm-text placeholder:text-cm-text-muted focus-visible:ring-cm-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-cm-text-muted hover:text-cm-text"
                      >
                        {showPw ? (
                          <IconEyeOff size={15} />
                        ) : (
                          <IconEye size={15} />
                        )}
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
                    className="w-full bg-cm-accent text-sm font-medium hover:bg-cm-accent-dim"
                    disabled={loading}
                  >
                    {loading ? (
                      <IconLoader2 size={15} className="animate-spin" />
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="justify-center pt-0">
            <p className="text-[10px] text-cm-text-muted">
              By continuing, you agree to our terms of service
            </p>
          </CardFooter>
        </Card>

        <p className="mt-6 text-center text-[10px] text-cm-text-muted">
          Powered by Endee Vector Database
        </p>
      </div>
    </div>
  );
}
