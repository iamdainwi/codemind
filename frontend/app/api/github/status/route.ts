import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const res = await fetch(`${BACKEND}/github/status`, {
      headers: { Authorization: authHeader },
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
