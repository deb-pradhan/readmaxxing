"use client";

/**
 * AppHeader — the shared sticky top bar used across every app screen.
 *
 * Left: the ReadMaxxing wordmark (links back to the library).
 * Right: optional action slot (theme switcher, page-specific buttons).
 *
 * Keeps a consistent, calm chrome across the app and gives sub-pages a
 * reliable way back to the library.
 */

import * as React from "react";
import Link from "next/link";

export interface AppHeaderProps {
  /** Right-aligned actions (theme switcher, buttons, etc.). */
  children?: React.ReactNode;
  /** Optional short label shown next to the wordmark (e.g. "Settings"). */
  section?: string;
}

export function AppHeader({ children, section }: AppHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-sticky border-b border-border-subtle bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/library" className="shrink-0 text-base font-bold tracking-tight text-ink">
            ReadMaxxing
          </Link>
          {section ? (
            <>
              <span aria-hidden className="text-ink-faint">
                /
              </span>
              <span className="truncate text-sm font-medium text-ink-muted">{section}</span>
            </>
          ) : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
      </div>
    </header>
  );
}
