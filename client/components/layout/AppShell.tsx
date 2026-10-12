"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import { useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
  username?: string;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/eval", label: "Evaluation", icon: "◎" },
];

export default function AppShell({ children, username }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex flex-col w-60 shrink-0 border-r border-border bg-sidebar">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            C
          </div>
          <span className="font-semibold text-sidebar-foreground">CodeMind</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {username?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <span className="text-sm text-sidebar-foreground flex-1 truncate">{username}</span>
            <button
              id="logout-btn"
              onClick={handleLogout}
              disabled={signingOut}
              title="Sign out"
              className="text-muted-foreground hover:text-foreground transition-colors text-xs"
            >
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
