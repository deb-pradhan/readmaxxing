"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Re-export the server-safe theme helper so existing call-sites that imported
// it from `./providers` keep working without round-tripping through the
// client boundary. The real definition lives in `@readmaxxing/ui/themes`.
export { initialThemeFromCookie } from "@readmaxxing/ui";

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Top-level providers wrapping the web app.
 *
 * - `QueryClientProvider` — TanStack Query for server state (positions,
 *   documents, summaries). Cached offline where possible.
 * - Theme: ReadMaxxing M-Chef design-system tokens, light by default with a
 *   true-dark mode on user opt-in (see DESIGN-SYSTEM §3).
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
