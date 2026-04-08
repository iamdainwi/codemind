"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrain, IconLoader2, IconX } from "@tabler/icons-react";

/**
 * /auth/github
 *
 * Intermediate page that GitHub (via our backend) redirects to after OAuth.
 * Reads ?cm_token and ?cm_user from the URL, persists them into localStorage
 * so the AuthProvider picks them up, then navigates to /dashboard.
 *
 * Using window.location instead of useSearchParams avoids the Suspense
 * boundary requirement in Next.js 15.
 */
export default function GitHubAuthPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("cm_token");
    const userRaw = params.get("cm_user");

    if (!token) {
      setError("No token received from GitHub. Please try again.");
      return;
    }

    // Persist the JWT
    localStorage.setItem("cm_token", token);

    // Persist user info if provided, otherwise fetch it
    if (userRaw) {
      try {
        const user = JSON.parse(decodeURIComponent(userRaw));
        localStorage.setItem("cm_user", JSON.stringify(user));
        router.replace("/dashboard");
        return;
      } catch {
        // fall through to fetch
      }
    }

    // Fetch user profile using the token
    fetch("/api/auth", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.user) {
          localStorage.setItem("cm_user", JSON.stringify(json.data.user));
        }
      })
      .catch(() => {})
      .finally(() => router.replace("/dashboard"));
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cm-bg">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cm-red/15">
          <IconX size={20} className="text-cm-red" />
        </div>
        <p className="text-sm text-cm-text">{error}</p>
        <button
          onClick={() => router.push("/login")}
          className="text-xs text-cm-accent hover:underline"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cm-bg">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cm-accent">
        <IconBrain size={24} className="text-white" />
      </div>
      <div className="flex items-center gap-2 text-cm-text-muted">
        <IconLoader2 size={16} className="animate-spin text-cm-accent" />
        <span className="text-sm">Signing in with GitHub…</span>
      </div>
    </div>
  );
}
