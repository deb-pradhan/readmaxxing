/**
 * Content script — runs in the page's isolated world (per
 * `manifest.json:content_scripts`).
 *
 * Responsibilities:
 *  1. On `READ_THIS_PAGE` from the popup / background: extract the
 *     article body via `@mozilla/readability`, POST it to the BFF's
 *     `/api/import` endpoint, and inject the floating overlay player
 *     keyed to the resulting `documentId`.
 *  2. On `OPEN_READER { docId }`: inject the overlay for a known doc
 *     (the popup reader's "Listen in overlay" button).
 *
 * UI-UX.md §11 consistency: the overlay reuses the same `Player` and
 * `KaraokeHighlighter` primitives the web app uses. We inject the
 * React tree into a shadow DOM host so the host page's CSS can't leak
 * in (or vice versa) — TESTING.md §2.15.4 (`chrome.storage` calls on
 * CSP-restricted pages).
 */

import { injectOverlay, type OverlayHandle } from "./components/OverlayPlayer";
import { bffFetch } from "./lib/auth";
import type { Message, MessageResponse } from "./lib/messages";

interface ReadabilityArticle {
  title: string;
  byline: string | null;
  content: string;
  textContent: string;
}

let activeOverlay: OverlayHandle | null = null;

async function handleReadThisPage(): Promise<MessageResponse<{ docId?: string }>> {
  try {
    const article = await extractArticle();
    if (!article) {
      return { ok: false, error: "readability_failed" };
    }
    const importRes = await bffFetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "url",
        sourceType: "url",
        url: window.location.href,
        title: article.title,
        text: article.textContent,
      }),
    });
    if (!importRes.ok) {
      return { ok: false, error: `import ${importRes.status}` };
    }
    const doc = (await importRes.json()) as { id: string; title: string };
    activeOverlay = await injectOverlay({
      docId: doc.id,
      title: doc.title,
      text: article.textContent,
    });
    return { ok: true, data: { docId: doc.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function handleOpenReader(docId: string): Promise<MessageResponse<{ docId: string }>> {
  try {
    const res = await bffFetch(`/api/documents/${encodeURIComponent(docId)}`);
    if (!res.ok) {
      return { ok: false, error: `doc ${res.status}` };
    }
    const doc = (await res.json()) as { id: string; title: string; text: string };
    activeOverlay = await injectOverlay({
      docId: doc.id,
      title: doc.title,
      text: doc.text,
    });
    return { ok: true, data: { docId: doc.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// Reference for the IDE/lint — activeOverlay is tracked so future
// "Close reader" commands can dismiss the overlay from the background.
void activeOverlay;

async function extractArticle(): Promise<ReadabilityArticle | null> {
  // The content script runs in the page's isolated world — `document`
  // is the host page. We clone it so Readability's mutations don't
  // affect the live page.
  const clone = document.cloneNode(true) as Document;
  // Readability is loaded as a static ESM module so it works under
  // MV3's CSP. (Dynamic `import()` works too; static is simpler.)
  const { Readability, isProbablyReaderable } = await import(
    /* @vite-ignore */ "@mozilla/readability"
  );
  if (!isProbablyReaderable(clone)) {
    return null;
  }
  const parsed = new Readability(clone).parse();
  if (!parsed) return null;
  return {
    title: parsed.title,
    byline: parsed.byline ?? null,
    content: parsed.content,
    textContent: parsed.textContent,
  };
}

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender: chrome.runtime.MessageSender, sendResponse: (response?: MessageResponse) => void) => {
    switch (msg.kind) {
      case "READ_THIS_PAGE":
        void handleReadThisPage().then(sendResponse);
        return true;
      case "OPEN_READER":
        void handleOpenReader(msg.docId).then(sendResponse);
        return true;
      case "AUTH_CHANGED":
      case "PING":
        sendResponse({ ok: true });
        return false;
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
        sendResponse({ ok: false, error: "unknown_message" });
        return false;
      }
    }
  },
);
