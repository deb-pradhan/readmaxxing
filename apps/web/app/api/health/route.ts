import { NextResponse } from "next/server";

/** Health check — used by Railway + uptime monitors. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: "web", timestamp: new Date().toISOString() });
}