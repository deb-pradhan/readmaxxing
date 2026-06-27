/**
 * Auth — tiny Privy wrapper scoped to the extension context.
 *
 * Per UI-UX.md §11 (cross-surface consistency) the extension uses the
 * same auth flow as the web app. The Privy access token is stored in
 * `chrome.storage.local` (scoped to this extension's ID), not in
 * `localStorage`, so it's isolated from the web app's storage. The
 * BFF accepts the same token via the `Authorization` header — no
 * separate verifier needed.
 *
 * In the popup we can't host the full Privy OAuth redirect (the
 * popup window is too constrained and gets closed when the user
 * navigates away), so sign-in happens on the web app and we listen
 * for the resulting token via the chrome.runtime message bridge.
 */

import * as React from "react";

interface AuthState {
  user: { id: string; displayName?: string | null } | null;
  loading: boolean;
  error: string | null;
}

interface UseAuth extends AuthState {
  signInWithToken: (token: string, user: { id: string; displayName?: string | null }) => void;
  signOut: () => void;
}

const STORAGE_KEY = "rmx-extension-auth";
const AUTH_CHANGE_EVENT = "rmx-auth-changed";

interface StoredAuth {
  token: string;
  user: { id: string; displayName?: string | null };
}

async function readStored(): Promise<StoredAuth | null> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return null;
  const out = await chrome.storage.local.get(STORAGE_KEY);
  const value = out[STORAGE_KEY] as StoredAuth | undefined;
  return value ?? null;
}

async function writeStored(value: StoredAuth | null): Promise<void> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) return;
  if (value === null) {
    await chrome.storage.local.remove(STORAGE_KEY);
  } else {
    await chrome.storage.local.set({ [STORAGE_KEY]: value });
  }
}

export function useAuth(): UseAuth {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await readStored();
      if (cancelled) return;
      setState({ user: stored?.user ?? null, loading: false, error: null });
    })();
    const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !(STORAGE_KEY in changes)) return;
      const next = changes[STORAGE_KEY]?.newValue as StoredAuth | undefined;
      setState({ user: next?.user ?? null, loading: false, error: null });
    };
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.onChanged.addListener(handler);
    }
    return () => {
      cancelled = true;
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        chrome.storage.onChanged.removeListener(handler);
      }
    };
  }, []);

  const signInWithToken = React.useCallback(
    (token: string, user: { id: string; displayName?: string | null }) => {
      void writeStored({ token, user });
      // Also dispatch a custom event so other contexts (background,
      // content scripts) can react without re-reading storage.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user } }));
      }
      setState({ user, loading: false, error: null });
    },
    [],
  );

  const signOut = React.useCallback(() => {
    void writeStored(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: null } }));
    }
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, signInWithToken, signOut };
}

/** Read the cached access token — used by the BFF fetch shim. */
export async function getAccessToken(): Promise<string | null> {
  const stored = await readStored();
  return stored?.token ?? null;
}

/** Where the BFF lives. Configurable via `chrome.storage.local.bffUrl`. */
export async function getBffUrl(): Promise<string> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return "http://localhost:3000";
  }
  const { bffUrl } = (await chrome.storage.local.get("bffUrl")) as { bffUrl?: string };
  return bffUrl ?? "https://readmaxxing.app";
}

/**
 * Fetch shim — adds the Privy bearer + the dev header fallback so the
 * BFF routes accept the call. Mirrors `apps/web/lib/tts/client.ts` etc.
 */
export async function bffFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const base = await getBffUrl();
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-extension", "rmx-mv3");
  return fetch(`${base.replace(/\/$/, "")}${path}`, { ...init, headers, credentials: "include" });
}
