/**
 * App shell — the popup is a small router that mounts one of:
 *   - `/library`  → ContinueShelf + recent docs (PopupLibrary)
 *   - `/reader/:docId` → reader view using the same ReaderColumn +
 *                         KaraokeHighlighter primitives from
 *                         `packages/ui`
 *   - `/settings` → voice + speed defaults
 *   - `/voice-clone` → reuses the BFF's consent flow via deep link
 *
 * The popup uses HashRouter so it survives the extension's navigation
 * semantics (popups don't have a server to handle push-state URLs).
 *
 * Auth: in the extension context we use the same Privy flow as the web
 * app, but the access token is stored in `chrome.storage.local`
 * (scoped to the extension). The BFF accepts the same `did:privy:...`
 * token via the Authorization header. See `lib/auth.ts` for the
 * wire-up.
 */

import * as React from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { PopupLibrary } from "./components/library/PopupLibrary";
import { PopupReader } from "./pages/PopupReader";
import { PopupSettings } from "./pages/PopupSettings";
import { PopupHeader } from "./components/PopupHeader";
import { useAuth } from "./lib/auth";

export function App(): React.JSX.Element {
  const { user, signOut } = useAuth();
  return (
    <HashRouter>
      <div className="flex h-full min-h-screen flex-col">
        <PopupHeader user={user} onSignOut={signOut} />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<PopupLibrary />} />
            <Route path="/library" element={<PopupLibrary />} />
            <Route path="/reader/:docId" element={<PopupReader />} />
            <Route path="/settings" element={<PopupSettings />} />
            <Route path="/voice-clone" element={<PopupSettings initialTab="voices" />} />
            <Route path="*" element={<PopupLibrary />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
