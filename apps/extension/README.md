# @readmaxxing/extension

Chrome MV3 extension for ReadMaxxing. Inject an overlay reader on any page; same player + karaoke as the web app.

## Install (dev)

```bash
pnpm install
pnpm --filter @readmaxxing/extension dev
# Load the unpacked extension from apps/extension/dist in chrome://extensions
```

## What it does

- "Read this page" button in the popup (or `Alt+R` shortcut).
- `@mozilla/readability` extracts the article body.
- POSTs the text to the BFF `/api/import` endpoint.
- Injects a floating overlay player keyed to the new `documentId`.
- Same `Player` + `ReaderColumn` + `KaraokeHighlighter` primitives as the web app.

## What's where

- `manifest.json` — MV3 manifest. Permissions: `activeTab`, `scripting`, `storage`, `identity`. Host permissions: `<all_urls>`.
- `src/background.ts` — service worker. Routes messages between popup ↔ content script; wires the `Alt+R` command.
- `src/content.ts` — runs in the host page. Reads article body, posts to BFF, injects the overlay.
- `src/popup.tsx` + `src/App.tsx` — React app for the popup frame (360×600).
- `src/components/OverlayPlayer.tsx` — the floating React tree injected on the active tab. Lives in a shadow DOM host so the page's CSS can't leak.
- `src/components/library/PopupLibrary.tsx` — ContinueShelf + recent docs. Reuses `@readmaxxing/ui`.
- `src/pages/PopupReader.tsx` — minimal reader for the popup frame; "Listen in overlay" opens the full one.
- `src/pages/PopupSettings.tsx` — default voice + speed. Writes via `/api/user/preferences`.
- `src/lib/auth.ts` — chrome.storage-backed auth shim.
- `src/lib/messages.ts` — typed message envelope.

## Cross-surface consistency (UI-UX.md §11)

Every primitive the extension renders comes from `@readmaxxing/ui` (Player, KaraokeHighlighter, ReaderColumn, VoicePicker, ContinueShelf). The bundle stays under 500 KB by code-splitting `@mozilla/readability` into its own vendor chunk (TESTING.md §2.15).

## Auth in the extension context

Sign-in happens on the web app (`https://readmaxxing.app/library`). Once signed in, the access token is mirrored into `chrome.storage.local` (scoped to this extension ID) via the same `did:privy:...` token. The BFF accepts the token via the `Authorization` header. No separate verifier.

## Tests

```bash
pnpm --filter @readmaxxing/extension test
```

Unit tests cover the message envelope + auth shim. The popup's React tree is covered by the snapshot test in `apps/web/test/` (when added in a later phase).

## Build

```bash
pnpm --filter @readmaxxing/extension build
# Outputs to apps/extension/dist — load unpacked.
```
