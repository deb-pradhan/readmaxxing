/**
 * Message-bridge — typed wrapper around chrome.runtime messaging.
 *
 * The popup, content script, and background service worker all live in
 * different JavaScript contexts; we use `chrome.runtime.sendMessage`
 * with a discriminated union for type-safe payloads. Adding a new
 * message type means adding a variant to `Message` here so every
 * caller is forced to handle it (TypeScript exhaustiveness).
 */

export type Message =
  | { kind: "READ_THIS_PAGE"; tabId?: number }
  | { kind: "AUTH_CHANGED"; user: { id: string; displayName?: string | null } | null }
  | { kind: "OPEN_READER"; docId: string }
  | { kind: "PING" };

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Send a message to the background service worker. */
export async function sendBackground<T = unknown>(msg: Message): Promise<MessageResponse<T>> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return { ok: false, error: "extension_runtime_unavailable" };
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (response: MessageResponse<T> | undefined) => {
        resolve(response ?? { ok: false, error: "no_response" });
      });
    } catch (err) {
      resolve({ ok: false, error: (err as Error).message });
    }
  });
}

/** Send a message to the active tab's content script. */
export async function sendTab<T = unknown>(tabId: number, msg: Message): Promise<MessageResponse<T>> {
  if (typeof chrome === "undefined" || !chrome.tabs?.sendMessage) {
    return { ok: false, error: "tabs_unavailable" };
  }
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, msg, (response: MessageResponse<T> | undefined) => {
        resolve(response ?? { ok: false, error: "no_response" });
      });
    } catch (err) {
      resolve({ ok: false, error: (err as Error).message });
    }
  });
}

/**
 * `READ_THIS_PAGE` — the popup's primary action. The background worker
 * extracts the active tab's URL, asks the content script to grab the
 * page body via `@mozilla/readability`, posts it to `/api/import`,
 * and tells the content script to inject the overlay player.
 */
export async function sendReadThisPageMessage(): Promise<MessageResponse<{ docId?: string }>> {
  return sendBackground({ kind: "READ_THIS_PAGE" });
}

/**
 * Broadcast an auth change to the background + content scripts. We
 * avoid leaking the access token into the message payload — the
 * receiver reads it from `chrome.storage.local` if it needs it.
 */
export async function broadcastAuthChange(user: { id: string; displayName?: string | null } | null): Promise<void> {
  await sendBackground({ kind: "AUTH_CHANGED", user });
}
