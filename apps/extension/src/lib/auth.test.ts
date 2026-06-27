/**
 * Extension auth lib — unit test for the chrome.storage shim.
 *
 * We assert the storage get/set contract without a real Chrome
 * runtime. The fake `chrome` global is wired in `vitest.setup.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      getURL: (p: string) => `chrome-extension://test/${p}`,
      id: "test",
    },
    storage: {
      local: {
        get: (k: string | string[] | Record<string, unknown>) => {
          if (typeof k === "string") return Promise.resolve({ [k]: storage.get(k) });
          if (Array.isArray(k)) {
            const out: Record<string, unknown> = {};
            for (const key of k) out[key] = storage.get(key);
            return Promise.resolve(out);
          }
          return Promise.resolve({});
        },
        set: (v: Record<string, unknown>) => {
          for (const [k, val] of Object.entries(v)) storage.set(k, val);
          return Promise.resolve();
        },
        remove: (k: string) => {
          storage.delete(k);
          return Promise.resolve();
        },
      },
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    tabs: { query: vi.fn(), sendMessage: vi.fn(), create: vi.fn() },
    scripting: { executeScript: vi.fn() },
    commands: { onCommand: { addListener: vi.fn() } },
    identity: {},
  } as unknown as typeof chrome;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extension auth shim", () => {
  it("returns null token when nothing is stored", async () => {
    const { getAccessToken } = await import("./auth");
    await expect(getAccessToken()).resolves.toBeNull();
  });

  it("round-trips a stored token", async () => {
    const { useAuth, getAccessToken } = await import("./auth");
    let api: ReturnType<typeof useAuth> | null = null;
    function Probe() {
      api = useAuth();
      return null;
    }
    const React = await import("react");
    const { render, waitFor } = await import("@testing-library/react");
    render(
      React.createElement(Probe),
    );
    await waitFor(() => expect(api?.loading).toBe(false));
    act_signIn(api!, "tok-123", { id: "u1", displayName: "Alice" });
    await waitFor(() => expect(api?.user?.id).toBe("u1"));
    await expect(getAccessToken()).resolves.toBe("tok-123");
  });

  it("signOut clears the stored token", async () => {
    const { useAuth, getAccessToken } = await import("./auth");
    let api: ReturnType<typeof useAuth> | null = null;
    const React = await import("react");
    const { render, waitFor } = await import("@testing-library/react");
    render(React.createElement(function Probe() {
      api = useAuth();
      return null;
    }));
    await waitFor(() => expect(api?.loading).toBe(false));
    act_signIn(api!, "tok-xyz", { id: "u2" });
    await waitFor(() => expect(api?.user?.id).toBe("u2"));
    api!.signOut();
    await waitFor(() => expect(api?.user).toBeNull());
    await expect(getAccessToken()).resolves.toBeNull();
  });
});

function act_signIn(api: { signInWithToken: (t: string, u: { id: string; displayName?: string | null }) => void }, token: string, user: { id: string; displayName?: string | null }) {
  api.signInWithToken(token, user);
}
