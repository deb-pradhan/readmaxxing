"use client";

import * as React from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { themes, type ThemeName } from "@readmaxxing/ui";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Top-level providers wrapping the web app.
 *
 * - `PrivyProvider` — auth. App id comes from `NEXT_PUBLIC_PRIVY_APP_ID`.
 *   Theme: warm-paper light by default, true-dark on user opt-in.
 * - `QueryClientProvider` — TanStack Query for server state (positions,
 *   documents, summaries). Cached offline where possible.
 *
 * The theme is exposed via `[data-theme=...]` on `<html>` and rendered
 * from a script that runs before React hydrates, so there's no FOUC.
 */
export function Providers({ children }: ProvidersProps): React.JSX.Element {
  const [client] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Per UI-UX.md §11 — feedback within 100ms; retry with backoff.
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        retry: 2,
      },
    },
  }));

  const privyAppId =
    process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "cl-placeholder-app-id";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        // Calmer login surface per UI-UX.md §6 — no marketing CTAs.
        appearance: {
          theme: "light",
          accentColor: "#5B4DEF",
          showWalletLoginFirst: false,
        },
        loginMethods: ["email", "wallet", "google"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PrivyProvider>
  );
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