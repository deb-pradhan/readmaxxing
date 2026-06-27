/**
 * PrivyProvider — wraps the mobile app with the Privy session.
 *
 * Phase 6 ships the *shape* of this provider — sign-in happens on the
 * web app today, and the resulting token is mirrored into the mobile
 * secure store via the Privy deep link (`readmaxxing://auth?token=…`).
 * The web → mobile handoff uses `expo-linking` to catch the URL.
 *
 * Phase 6.1 will swap this stub for `@privy-io/expo-auth` so the
 * full OAuth + wallet flow runs natively on mobile.
 */

import * as React from "react";
import * as Linking from "expo-linking";

interface PrivyContext {
  /** Subscribe to deep-link auth hand-offs from the web app. */
  onAuthHandled: (cb: (token: string) => void) => () => void;
}

const Ctx = React.createContext<PrivyContext | null>(null);

export function PrivyProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  React.useEffect(() => {
    const sub = Linking.addEventListener("url", (event) => {
      const url = new URL(event.url);
      if (url.protocol === "readmaxxing:" && url.host === "auth") {
        const token = url.searchParams.get("token");
        if (token) {
          // Broadcast to listeners — the auth screen wires this up.
          (globalThis as unknown as { __rmxAuthToken?: string }).__rmxAuthToken = token;
        }
      }
    });
    return () => sub.remove();
  }, []);

  const onAuthHandled = React.useCallback((cb: (token: string) => void) => {
    let lastSeen: string | undefined;
    const interval = setInterval(() => {
      const next = (globalThis as unknown as { __rmxAuthToken?: string }).__rmxAuthToken;
      if (next && next !== lastSeen) {
        lastSeen = next;
        cb(next);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return <Ctx.Provider value={{ onAuthHandled }}>{children}</Ctx.Provider>;
}

export function usePrivy(): PrivyContext {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("usePrivy must be used inside PrivyProvider");
  return ctx;
}
