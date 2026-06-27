/**
 * Background service worker — the cross-context coordinator.
 *
 * Responsibilities:
 *  1. Relay messages between popup ↔ content script (popup lives in
 *     its own frame, content script lives in the page, neither can
 *     reach the other directly).
 *  2. Implement the `Alt+R` keyboard shortcut
 *     (`chrome.commands`) — toggles the overlay on the active tab.
 *  3. Forward `READ_THIS_PAGE` from the popup to the active tab's
 *     content script, which then calls Readability + posts to the
 *     BFF + injects the overlay.
 *  4. Forward `OPEN_READER` to a specific tab's content script.
 *
 * Privacy: we deliberately do NOT receive the access token in any
 * message. The content script reads it from `chrome.storage.local`
 * (same scope as the popup) when it needs it.
 */

import { bffFetch, getAccessToken } from "./lib/auth";
import type { Message, MessageResponse } from "./lib/messages";

type Sender = chrome.runtime.MessageSender;
type SendResponse = (response?: MessageResponse) => void;

const READABILITY_SCRIPT_PATH = "src/content.ts";

async function handleMessage(
  msg: Message,
  _sender: Sender,
  sendResponse: SendResponse,
): Promise<void> {
  switch (msg.kind) {
    case "PING":
      sendResponse({ ok: true, data: { ts: Date.now() } });
      return;
    case "AUTH_CHANGED":
      // No-op in the background; the popup already wrote to storage.
      // We could fan out to all tabs here, but the content script
      // listens to `chrome.storage.onChanged` directly.
      sendResponse({ ok: true });
      return;
    case "READ_THIS_PAGE": {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: "no_active_tab" });
          return;
        }
        // Inject the content script if it isn't already running on
        // this tab. We use programmatic injection so we can wait for
        // the promise to resolve before sending the message — chrome
        // guarantees the script has loaded when `executeScript` resolves.
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [READABILITY_SCRIPT_PATH],
        });
        const reply = await chrome.tabs.sendMessage(tab.id, {
          kind: "READ_THIS_PAGE",
        } satisfies Message);
        sendResponse(reply);
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message });
      }
      return;
    }
    case "OPEN_READER": {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: "no_active_tab" });
          return;
        }
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [READABILITY_SCRIPT_PATH],
        });
        const reply = await chrome.tabs.sendMessage(tab.id, msg);
        sendResponse(reply);
      } catch (err) {
        sendResponse({ ok: false, error: (err as Error).message });
      }
      return;
    }
    default: {
      // Exhaustiveness check — TS will flag missing variants.
      const _exhaustive: never = msg;
      void _exhaustive;
      sendResponse({ ok: false, error: "unknown_message" });
      return;
    }
  }
}

chrome.runtime.onMessage.addListener((msg: Message, sender: Sender, sendResponse: SendResponse) => {
  // `sendResponse` must be called synchronously OR `return true` to
  // keep the message channel open for an async reply. We do the latter.
  void handleMessage(msg, sender, sendResponse);
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-reader") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [READABILITY_SCRIPT_PATH],
  });
  await chrome.tabs.sendMessage(tab.id, { kind: "READ_THIS_PAGE" } satisfies Message);
});

// Self-ping on install so the worker registers its handler eagerly.
// (Manifest V3 service workers can be torn down between events; this
// is a no-op safety net.)
void getAccessToken();
void bffFetch("/api/health").catch(() => undefined);
