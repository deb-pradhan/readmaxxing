/**
 * Mobile auth — the same Privy token flow as web + extension, but
 * stored via `expo-secure-store` (the platform-native secure keychain).
 *
 * The mobile app and the web app share the Privy `did:privy:...`
 * identity, so a user signs in on either device and the BFF accepts
 * the token via the same `Authorization` header. The SSE position
 * sync keeps both surfaces in sync.
 */

import * as React from "react";

const TOKEN_STORAGE_KEY = "rmx-mobile-token";
const USER_STORAGE_KEY = "rmx-mobile-user";

interface AuthState {
  user: { id: string; displayName?: string | null } | null;
  loading: boolean;
  error: string | null;
}

interface UseAuth extends AuthState {
  signInWithToken: (token: string, user: { id: string; displayName?: string | null }) => Promise<void>;
  signOut: () => Promise<void>;
}

async function readToken(): Promise<string | null> {
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    return await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeToken(token: string | null): Promise<void> {
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    if (token === null) await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    else await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  } catch {
    /* secure store unavailable (e.g. simulator); ignore */
  }
}

async function readUser(): Promise<{ id: string; displayName?: string | null } | null> {
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    const raw = await SecureStore.getItemAsync(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeUser(user: { id: string; displayName?: string | null } | null): Promise<void> {
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    if (user === null) await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
    else await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function useAuth(): UseAuth {
  const [state, setState] = React.useState<AuthState>({ user: null, loading: true, error: null });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [token, user] = await Promise.all([readToken(), readUser()]);
      if (cancelled) return;
      setState({ user: token ? user : null, loading: false, error: null });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithToken = React.useCallback(async (token: string, user: { id: string; displayName?: string | null }) => {
    await Promise.all([writeToken(token), writeUser(user)]);
    setState({ user, loading: false, error: null });
  }, []);

  const signOut = React.useCallback(async () => {
    await Promise.all([writeToken(null), writeUser(null)]);
    setState({ user: null, loading: false, error: null });
  }, []);

  return { ...state, signInWithToken, signOut };
}

/** Fetch shim — adds the Privy bearer + the extension/mobile header. */
export async function bffFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base =
    typeof process !== "undefined" && process.env
      ? (process.env["EXPO_PUBLIC_BFF_URL"] ?? "https://readmaxxing.app")
      : "https://readmaxxing.app";
  const token = await readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-mobile", "rmx-expo");
  return fetch(`${base.replace(/\/$/, "")}${path}`, { ...init, headers });
}
