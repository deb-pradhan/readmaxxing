"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { themes, type ThemeName } from "@readmaxxing/ui";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Top-level providers wrapping the web app.
 *
 * - `QueryClientProvider` — TanStack Query for server state (positions,
 *   documents, summaries). Cached offline where possible.
 * - Theme: warm-paper light by default, true-dark on user opt-in.
 *
 * Auth (Privy) is intentionally **not** wired here in Phase 1 — the
 * middleware uses the `x-dev-user-id` dev header. Phase 2 wraps with
 * `PrivyProvider` once real auth lands.
 */
export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/**
 * Helper for picking the theme from a server-rendered `theme` cookie
 * (used by `app/layout.tsx` to set `[data-theme]` before hydration).
 */
export function initialThemeFromCookie(cookie: string | undefined): ThemeName {
  if (!cookie) return "light";
  if (cookie in themes) return cookie as ThemeName;
  return "light";
}