/**
 * Privy identity-token verification helper.
 *
 * Phase 1 STUB — accept locally shaped tokens so the rest of the app
 * compiles, runs, and the BFF can be exercised end-to-end. Phase 2 swaps
 * this body for `@privy-io/node`'s `PrivyClient.utils().auth().verifyAccessToken`
 * (note: `verifyAuthToken` was deprecated in @privy-io/node v0.7.0).
 *
 * The signature is intentionally narrow: `Promise<{ userId; email? }>` so the
 * real verifier is a drop-in change.
 */

export interface VerifiedPrivyIdentity {
  /** Privy DID, e.g. `did:privy:cmqszhecc00650cl3npydgf42`. */
  userId: string;
  /** Optional email claimed by the token. Phase 2 will populate this from
   *  Privy's verified claims. */
  email?: string;
}

export type PrivyIdentityToken = string;

/**
 * Verify a Privy identity token.
 *
 * Phase 2 wiring (replace the body with this call):
 *
 * ```ts
 * import { PrivyClient } from "@privy-io/node";
 *
 * const privy = new PrivyClient({
 *   appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
 *   appSecret: process.env.PRIVY_APP_SECRET!,
 * });
 * const claims = await privy.utils().auth().verifyAccessToken({ access_token: token });
 * return { userId: claims.userId };
 * ```
 *
 * Pin the JWT verification key in the dashboard to skip the round-trip:
 *
 * ```ts
 * const privy = new PrivyClient({
 *   appId: ...,
 *   appSecret: ...,
 *   jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY!,
 * });
 * ```
 */
export async function verifyPrivyIdentityToken(
  token: PrivyIdentityToken | undefined,
): Promise<VerifiedPrivyIdentity | null> {
  if (!token) return null;

  // TODO(phase-2): replace with `PrivyClient.utils().auth().verifyAccessToken`.
  // Until then, accept tokens shaped like `did:privy:...` and a permissive
  // dev fallback so local development doesn't require a real Privy issuer.

  if (token.startsWith("did:privy:")) {
    return { userId: token.slice("did:privy:".length) };
  }

  if (token.length >= 8 && !token.startsWith("invalid")) {
    return { userId: `dev:${token.slice(0, 16)}` };
  }

  return null;
}

/**
 * Verify a Privy webhook signature.
 *
 * Phase 2 wiring (replace with real HMAC check):
 *
 * ```ts
 * import crypto from "node:crypto";
 *
 * const expected = crypto
 *   .createHmac("sha256", process.env.PRIVY_WEBHOOK_SECRET!)
 *   .update(rawBody)
 *   .digest("hex");
 * return expected === signature;
 * ```
 */
export async function verifyPrivyWebhook(
  _rawBody: string,
  signature: string | null,
): Promise<boolean> {
  // TODO(phase-2): replace with the real HMAC check shown above.
  return Boolean(signature);
}