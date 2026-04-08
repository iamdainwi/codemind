import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const body = await req.json();

    const res = await fetch(`${BACKEND}/github/ingest`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      // Repos can be large — allow up to 5 minutes
      signal: AbortSignal.timeout(300_000),
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
