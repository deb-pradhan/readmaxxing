/**
 * Dev auth middleware.
 *
 * Phase 1: trust the `x-dev-user-id` request header (or the `rmx-dev-user`
 * cookie) and forward it to the BFF as `x-user-id`. Real Privy lands in
 * Phase 2 — at that point this middleware swaps the dev header for a JWT
 * verification call against `@privy-io/node`. Until then, `lib/privy-verify.ts`
 * holds the stub verifier.
 *
 * Public paths (no auth required):
 *   - `/api/health`              — Railway health probe
 *   - `/api/auth/webhook`        — Privy calls this without a session token
 *   - `/api/voices`              — public voice catalog
 *   - `/api/tts` GET             — voice catalog
 *   - `/`                        — homepage (no listening saved until POST)
 *   - `/reader/*`                — client-side IndexedDB + BFF fetch; the page
 *     asks for `x-user-id` and falls back to a dev default
 */

import { NextResponse, type NextRequest } from "next/server";

const DEV_COOKIE = "rmx-dev-user";
const PUBLIC_API_PREFIXES = [
  "/api/health",
  "/api/auth/webhook",
  "/api/voices",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/reader/")) return true;
  // GET /api/tts is a public voice listing; POST is gated by x-user-id.
  if (pathname === "/api/tts") return true;
  return false;
}

function resolveDevUserId(request: NextRequest): string {
  const headerUser = request.headers.get("x-dev-user-id");
  if (headerUser && headerUser.length > 0 && headerUser.length <= 128) {
    return headerUser;
  }
  const cookieUser = request.cookies.get(DEV_COOKIE)?.value;
  if (cookieUser && cookieUser.length > 0 && cookieUser.length <= 128) {
    return decodeURIComponent(cookieUser);
  }
  // Default to a stable dev id so the BFF always has a non-empty `x-user-id`
  // in local development. Real Phase 2 auth will 401 here.
  return "dev-user";
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    const userId = resolveDevUserId(request);
    const headers = new Headers(request.headers);
    headers.set("x-user-id", userId);
    headers.set("x-dev-user-id", userId);
    return NextResponse.next({ request: { headers } });
  }

  const userId = resolveDevUserId(request);
  const headers = new Headers(request.headers);
  headers.set("x-user-id", userId);
  headers.set("x-dev-user-id", userId);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Match API + reader + homepage; static assets excluded.
  matcher: ["/", "/reader/:path*", "/api/:path*"],
};