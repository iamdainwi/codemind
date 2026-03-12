import { NextRequest } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const authHeader = req.headers.get("authorization") || "";

  const res = await fetch(`${BACKEND}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
