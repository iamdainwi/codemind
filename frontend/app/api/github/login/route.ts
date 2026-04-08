import { NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

// No auth header needed — this is for unauthenticated users on the login page
export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/github/login`);
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
