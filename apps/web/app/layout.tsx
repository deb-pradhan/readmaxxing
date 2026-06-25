import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Source_Serif_4, Atkinson_Hyperlegible } from "next/font/google";
import { themeCssVars, themes } from "@readmaxxing/ui";
import { Providers, initialThemeFromCookie } from "./providers";
import "./globals.css";

// Per UI-UX.md §3.2:
// - Long-form serif: Source Serif 4 (book-like).
// - UI sans: Inter.
// - Dyslexia option: Atkinson Hyperlegible (offer, never force).
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-loaded",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif-loaded",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dyslexia-loaded",
  weight: ["400", "700"],
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
    { media: "(prefers-color-scheme: light)", color: "#FBFBF8" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0E10" },
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
      className={`${inter.variable} ${sourceSerif.variable} ${atkinson.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh bg-canvas text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}