import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

const API =
  process.env.INTERNAL_API_URL ||
  (process.env.NODE_ENV === "production" ? "http://backend:8000" : "http://localhost:8000");

async function getCurrentUser(cookieHeader: string) {
  try {
    const res = await fetch(`${API}/api/v1/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    const json = await res.json();
    if (json.success) return json.data as { user_id: string; username: string };
    return null;
  } catch (err) {
    console.error("Auth check failed against", API, err);
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  const cookieHeader = session ? `session=${session}` : cookieStore.toString();
  const user = await getCurrentUser(cookieHeader);

  if (!user) {
    redirect("/login");
  }

  return <AppShell username={user.username}>{children}</AppShell>;
}
