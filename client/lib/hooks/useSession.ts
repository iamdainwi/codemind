"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getMe, logout as apiLogout } from "@/lib/api/auth";
import type { User } from "@/types/api";

export function useSession() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await getMe();
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
        if (!pathname?.startsWith("/login") && !pathname?.startsWith("/register") && pathname !== "/") {
          router.push("/login");
        }
      }
    } catch {
      setUser(null);
      if (!pathname?.startsWith("/login") && !pathname?.startsWith("/register") && pathname !== "/") {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [pathname, router]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push("/login");
  }, [router]);

  return { user, loading, logout, refresh: checkAuth };
}
