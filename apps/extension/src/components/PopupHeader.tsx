/**
 * PopupHeader — minimal header with the user's avatar + sign-out button.
 *
 * In the popup context, "user" comes from `useAuth()` — a tiny wrapper
 * around chrome.storage.local that caches the Privy access token. When
 * the user is signed out we show a "Sign in" link that deep-links to
 * the web app where the full Privy flow lives (the popup can't host
 * the OAuth redirect).
 */

import * as React from "react";
import { Link } from "react-router-dom";

export interface PopupHeaderProps {
  user: { id: string; displayName?: string | null } | null;
  onSignOut?: () => void;
}

export function PopupHeader({ user, onSignOut }: PopupHeaderProps): React.JSX.Element {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border-subtle bg-card px-4 py-2">
      <Link
        to="/library"
        className="text-lg font-semibold text-ink focus-visible:outline-none focus-visible:shadow-focus"
      >
        ReadMaxxing
      </Link>
      {user ? (
        <div className="flex items-center gap-2">
          <span className="max-w-[10rem] truncate text-xs text-ink-muted">
            {user.displayName ?? user.id.slice(0, 12)}
          </span>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-md border border-border px-2 py-0.5 text-xs text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
            >
              Sign out
            </button>
          ) : null}
        </div>
      ) : (
        <a
          href="https://readmaxxing.app/library"
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-coral-bg px-3 py-1 text-xs font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:shadow-focus"
        >
          Sign in
        </a>
      )}
    </header>
  );
}
