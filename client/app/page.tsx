import { redirect } from "next/navigation";

/**
 * Root page — redirect to dashboard if authenticated, else login.
 * The auth check happens in the (app) layout's middleware-style guard.
 */
export default function RootPage() {
  redirect("/dashboard");
}
