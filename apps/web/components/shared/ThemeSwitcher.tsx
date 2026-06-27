"use client";

/**
 * ThemeSwitcher — cycles Light → Dark → Sepia → E-ink.
 *
 * Per DESIGN-SYSTEM.md §3.1 + §5: one-tap theme switch. E-ink is the
 * new low-stimulation grayscale mode for long reading sessions.
 */

import * as React from "react";
import { themes, type ThemeName } from "@readmaxxing/ui";

const ORDER: ThemeName[] = ["light", "dark", "sepia", "eink"];

const LABELS: Record<ThemeName, string> = {
  light: "Light",
  dark: "Dark",
  sepia: "Sepia",
  eink: "E-ink",
};

const COOKIE = "theme";

export interface ThemeSwitcherProps {
  /** Initial theme — if omitted, reads the `theme` cookie. */
  initial?: ThemeName;
  className?: string;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

const ALL_VARS = [
  "--surface-canvas",
  "--surface-card",
  "--surface-muted",
  "--surface-elevated",
  "--surface-inverse",
  "--surface-overlay",
  "--text-primary",
  "--text-secondary",
  "--text-tertiary",
  "--text-inverse",
  "--text-inverse-muted",
  "--border-subtle",
  "--border-default",
  "--border-strong",
  "--border-inverse",
  "--hover-tint",
] as const;

export function ThemeSwitcher({
  initial,
  className,
}: ThemeSwitcherProps): React.JSX.Element {
  const [theme, setTheme] = React.useState<ThemeName>(
    () =>
      initial ??
      ((readCookie(COOKIE) as ThemeName | undefined) ?? "light"),
  );

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", theme);
    const tokens = themes[theme];
    const map: Record<string, string> = {
      "--surface-canvas": tokens.surfaceCanvas,
      "--surface-card": tokens.surfaceCard,
      "--surface-muted": tokens.surfaceMuted,
      "--surface-elevated": tokens.surfaceElevated,
      "--surface-inverse": tokens.surfaceInverse,
      "--surface-overlay": tokens.surfaceOverlay,
      "--text-primary": tokens.textPrimary,
      "--text-secondary": tokens.textSecondary,
      "--text-tertiary": tokens.textTertiary,
      "--text-inverse": tokens.textInverse,
      "--text-inverse-muted": tokens.textInverseMuted,
      "--border-subtle": tokens.borderSubtle,
      "--border-default": tokens.borderDefault,
      "--border-strong": tokens.borderStrong,
      "--border-inverse": tokens.borderInverse,
      "--hover-tint": tokens.hoverTint,
    };
    for (const v of ALL_VARS) {
      document.documentElement.style.setProperty(v, map[v] ?? "");
    }
    writeCookie(COOKIE, theme);
  }, [theme]);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABELS[theme]}. Click to switch to ${LABELS[next]}`}
      className={
        className ??
        "inline-flex h-12 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-ink hover:bg-card-muted focus-visible:outline-none focus-visible:shadow-focus"
      }
    >
      <span aria-hidden>{theme === "dark" ? "☾" : theme === "sepia" ? "✦" : theme === "eink" ? "▤" : "☀"}</span>
      <span>{LABELS[theme]}</span>
    </button>
  );
}

export type { ThemeName };