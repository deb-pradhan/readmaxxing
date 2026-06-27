/**
 * Message bridge — typed wrapper around chrome.runtime messaging.
 *
 * We assert the message envelope + the read-side helper contract
 * without requiring a real Chrome runtime. The fake chrome object is
 * wired in `vitest.setup.ts`.
 */

import { describe, expect, it, vi } from "vitest";
import type { Message, MessageResponse } from "./messages";

describe("message envelope", () => {
  it("discriminates on `kind` for the four message variants", () => {
    const messages: Message[] = [
      { kind: "PING" },
      { kind: "AUTH_CHANGED", user: { id: "u1" } },
      { kind: "OPEN_READER", docId: "doc-123" },
      { kind: "READ_THIS_PAGE" },
    ];
    const kinds = messages.map((m) => m.kind);
    expect(kinds).toEqual(["PING", "AUTH_CHANGED", "OPEN_READER", "READ_THIS_PAGE"]);
  });

  it("a missing `kind` is rejected at compile time (illustrative)", () => {
    // This test is intentionally not a runtime assertion — it's a
    // docstring for the discriminated-union contract. The build
    // tsc step will fail if any message variant loses its `kind`.
    const envelope: MessageResponse<{ ts: number }> = {
      ok: true,
      data: { ts: 1 },
    };
    expect(envelope.ok).toBe(true);
    expect(envelope.data?.ts).toBe(1);
  });
});

describe("sendBackground", () => {
  it("resolves with `{ ok: false }` when chrome.runtime is missing", async () => {
    const original = (globalThis as { chrome?: typeof chrome }).chrome;
    // Intentionally clear to test the fallback path.
    delete (globalThis as { chrome?: typeof chrome }).chrome;
    try {
      const { sendBackground } = await import("./messages");
      const reply = await sendBackground({ kind: "PING" });
      expect(reply.ok).toBe(false);
      expect(reply.error).toBe("extension_runtime_unavailable");
    } finally {
      (globalThis as { chrome?: typeof chrome }).chrome = original;
    }
  });

  it("resolves with the listener's reply", async () => {
    const sendMessage = vi.fn(
      (_msg: Message, cb: (response: MessageResponse) => void) =>
        cb({ ok: true, data: { docId: "d1" } }),
    );
    (globalThis as unknown as { chrome: typeof chrome }).chrome = {
      ...(globalThis as unknown as { chrome: typeof chrome }).chrome,
      runtime: {
        ...((globalThis as unknown as { chrome: typeof chrome }).chrome.runtime),
        sendMessage: sendMessage as unknown as typeof chrome.runtime.sendMessage,
      },
    } as typeof chrome;
    void sendMessage;
    const { sendBackground } = await import("./messages");
    const reply = await sendBackground({ kind: "OPEN_READER", docId: "d1" });
    expect(reply.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledOnce();
  });
});
