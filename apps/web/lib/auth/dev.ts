/**
 * Dev-only auth helpers.
 *
 * Phase 1 ships a stubbed auth flow per the prompt: the `x-dev-user-id`
 * request header gates API access. Real Privy lands in Phase 2 — see
 * `apps/web/middleware.ts` for the middleware-level enforcement and
 * `docs/PHASE-1-STATUS.md` for the rollout plan.
 *
 * On the client (web/mobile/extension) there is no real auth state; the
 * middleware injects `x-user-id` into the forwarded request, and the
 * client just trusts the first value it sees. The helpers here are kept
 * tiny so swapping in Privy is a one-file change.
 */

export const DEV_USER_HEADER = "x-dev-user-id";
export const DEV_DEFAULT_USER_ID = "dev-user";

/** Read the dev user id from a request (server-side). */
export function devUserIdFromRequest(request: Request): string {
  const h = request.headers.get(DEV_USER_HEADER);
  if (h && h.length > 0 && h.length <= 128) return h;
  return DEV_DEFAULT_USER_ID;
}

/** Build a `Headers` object suitable for fetch() that carries the dev user id. */
export function devUserHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  // The browser can't set `x-dev-user-id` directly (CORS). The BFF
  // middleware reads the cookie and sets the header server-side, so the
  // client only needs to forward the cookie (handled by `credentials`).
  return headers;
}

/** Get a dev user id from a (client-side) cookie, or return the default. */
export function devUserIdFromCookies(cookie: string | undefined | null): string {
  if (!cookie) return DEV_DEFAULT_USER_ID;
  const match = cookie.match(/(?:^|;\s*)rmx-dev-user=([^;]+)/);
  if (!match) return DEV_DEFAULT_USER_ID;
  const value = decodeURIComponent(match[1]!);
  return value.length > 0 && value.length <= 128 ? value : DEV_DEFAULT_USER_ID;
}

/** Set the dev-user cookie via `document.cookie`. */
export function setDevUserCookie(userId: string): void {
  if (typeof document === "undefined") return;
  const safe = encodeURIComponent(userId);
  document.cookie = `rmx-dev-user=${safe}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}