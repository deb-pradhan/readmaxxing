import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { themeCssVars, themes, initialThemeFromCookie } from "@readmaxxing/ui";
import { Providers } from "./providers";
import "./globals.css";

// Per DESIGN-SYSTEM.md §4.1 + §25.2:
// - Inter is the UI / display family (sans). No Source Serif, no Atkinson.
// - Geist Mono (v2) is the instrument-grade mono for numerals / timecodes /
//   counts. next/font/google doesn't ship Geist Mono, so we load the
//   closest match (JetBrains Mono) under `--font-mono-loaded` and the
//   font stack falls through to JetBrains Mono / ui-monospace via
//   `--font-mono` in globals.css.
// - Tabular figures globally on body (handled in globals.css).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-loaded",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: {
    default: "ReadMaxxing",
    template: "%s · ReadMaxxing",
  },
  description:
    "Read faster, listen deeper. A Speechify-class voice AI reading app.",
  applicationName: "ReadMaxxing",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ECEFE6" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F12" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const themeCookie = (await cookies()).get("theme")?.value;
  const themeName = initialThemeFromCookie(themeCookie);
  const themeVars = themeCssVars(themes[themeName]);

  return (
    <html
      lang="en"
      data-theme={themeName}
      style={themeVars as React.CSSProperties}
      className={`${inter.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}