/**
 * Root layout — mounted by expo-router at `app/_layout.tsx`.
 *
 * Responsibilities:
 *  1. Wire the theme provider (light/dark/sepia follow system).
 *  2. Provide the Privy session via the PrivyProvider (the same flow
 *     the web app uses). The session token is cached in `expo-secure-store`
 *     so the user stays signed in across app restarts.
 *  3. Mount the `Stack` so child routes can render.
 *
 * Per UI-UX.md §6 the onboarding is short — 3 steps, non-blocking,
 * skippable. We surface the onboarding sheet via a separate modal route
 * so the tabs always mount at the root.
 */

import { Stack } from "expo-router";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PrivyProvider } from "@/components/PrivyProvider";

export default function RootLayout(): React.JSX.Element {
  return (
    <ThemeProvider>
      <PrivyProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            // Honor `prefers-reduced-motion` for screen transitions.
            animation: "fade",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="doc/[docId]" options={{ headerShown: false, presentation: "modal" }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "modal" }} />
        </Stack>
      </PrivyProvider>
    </ThemeProvider>
  );
}
