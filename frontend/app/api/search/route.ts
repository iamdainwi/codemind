import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const top_k = searchParams.get("top_k") || "8";
  const authHeader = req.headers.get("authorization") || "";

  try {
    const res = await fetch(
      `${BACKEND}/search?q=${encodeURIComponent(q)}&top_k=${top_k}`,
      { headers: { Authorization: authHeader } },
    );
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: String(e) },
      { status: 500 },
    );
  }
}
