import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file_path = searchParams.get("file_path") || "";
  const top_k = searchParams.get("top_k") || "4";
  const authHeader = req.headers.get("authorization") || "";

  try {
    const res = await fetch(
      `${BACKEND}/recommend?file_path=${encodeURIComponent(file_path)}&top_k=${top_k}`,
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
