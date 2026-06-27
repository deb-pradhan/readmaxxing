/**
 * Mobile auth shim — unit test that exercises the storage contract
 * with a mocked `expo-secure-store`. The full RN runtime isn't
 * required because the auth lib only depends on `expo-secure-store`
 * at module-load time (and even that's lazy-imported for SSR).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  default: {
    getItemAsync: async (key: string) => store.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      store.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      store.delete(key);
    },
  },
}));

beforeEach(() => {
  store.clear();
  process.env["EXPO_PUBLIC_BFF_URL"] = "https://bff.example";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["EXPO_PUBLIC_BFF_URL"];
});

describe("mobile auth shim", () => {
  it("returns null user when nothing is stored", async () => {
    const { useAuth } = await import("./auth");
    const captured: ReturnType<typeof useAuth>[] = [];
    const React = await import("react");
    const { render, waitFor } = await import("@testing-library/react");
    render(
      React.createElement(function Probe() {
        captured.push(useAuth());
        return null;
      }),
    );
    await waitFor(() => expect(captured.at(-1)?.loading).toBe(false));
    expect(captured.at(-1)?.user).toBeNull();
  });

  it("signInWithToken round-trips through SecureStore", async () => {
    const { useAuth } = await import("./auth");
    const captured: ReturnType<typeof useAuth>[] = [];
    const React = await import("react");
    const { render, waitFor, act } = await import("@testing-library/react");
    render(
      React.createElement(function Probe() {
        captured.push(useAuth());
        return null;
      }),
    );
    await waitFor(() => expect(captured.at(-1)?.loading).toBe(false));
    await act(async () => {
      await captured.at(-1)!.signInWithToken("did:privy:abc", { id: "u1", displayName: "Alice" });
    });
    await waitFor(() => expect(captured.at(-1)?.user?.id).toBe("u1"));
    expect(store.get("rmx-mobile-token")).toBe("did:privy:abc");
  });

  it("signOut clears the stored credentials", async () => {
    const { useAuth } = await import("./auth");
    const captured: ReturnType<typeof useAuth>[] = [];
    const React = await import("react");
    const { render, waitFor, act } = await import("@testing-library/react");
    render(
      React.createElement(function Probe() {
        captured.push(useAuth());
        return null;
      }),
    );
    await waitFor(() => expect(captured.at(-1)?.loading).toBe(false));
    await act(async () => {
      await captured.at(-1)!.signInWithToken("did:privy:abc", { id: "u1" });
    });
    await act(async () => {
      await captured.at(-1)!.signOut();
    });
    await waitFor(() => expect(captured.at(-1)?.user).toBeNull());
    expect(store.has("rmx-mobile-token")).toBe(false);
  });
});

describe("bffFetch", () => {
  it("adds the auth bearer + x-mobile header", async () => {
    const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    store.set("rmx-mobile-token", "did:privy:abc");
    const { bffFetch } = await import("./auth");
    await bffFetch("/api/health");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = fetchSpy.mock.calls[0]?.[0];
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(url).toBe("https://bff.example/api/health");
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer did:privy:abc");
    expect(headers.get("x-mobile")).toBe("rmx-expo");
    vi.unstubAllGlobals();
  });
});
