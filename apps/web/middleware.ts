import { NextResponse, type NextRequest } from "next/server";
import { PRIVY_COOKIE } from "@readmaxxing/config";

/**
 * Privy authentication middleware.
 *
 * - Verifies the Privy identity token from the cookie on `/api/*` routes.
 * - Allows unauthenticated access to `/api/auth/webhook` (Privy calls this
 *   without a user token — it uses a webhook secret instead).
 * - Lets non-API routes through untouched (the client uses Privy's React
 *   SDK to manage session state, and public marketing/landing pages should
 *   not be gated).
 *
 * The actual cryptographic verification is delegated to a small adapter so
 * the middleware stays thin and easy to mock. Phase 2 wires the real
 * `@privy-io/node` verification here.
 */

const PUBLIC_API_PREFIXES = ["/api/auth/webhook", "/api/health"];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

async function verifyPrivyToken(token: string | undefined): Promise<{ userId: string } | null> {
  if (!token) return null;

  // Phase 1 stub: trust the token shape ("did:privy:...") so the rest of the
  // app can compile and run end-to-end. Real verification happens in Phase 2
  // via the @privy-io/node helpers — see the comment in `lib/privy-verify.ts`.
  const { verifyPrivyIdentityToken } = await import("./lib/privy-verify");
  return verifyPrivyIdentityToken(token);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  if (isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // Privy stores the identity token as an HttpOnly cookie after login.
  const token = request.cookies.get(PRIVY_COOKIE)?.value;
  const verified = await verifyPrivyToken(token);

  if (!verified) {
    return NextResponse.json(
      { error: "unauthorized", message: "Missing or invalid Privy token." },
      { status: 401 },
    );
  }

  // Surface the verified userId to downstream handlers.
  const headers = new Headers(request.headers);
  headers.set("x-user-id", verified.userId);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Match all API routes; everything else is handled by individual pages.
  matcher: ["/api/:path*"],
};