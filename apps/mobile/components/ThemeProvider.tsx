/**
 * ThemeProvider — RN-native theme context mirroring the M-Chef
 * design system.
 *
 * Tokens are inlined here for the MVP; the web + extension + mobile
 * surfaces share the same hex values so the visuals are consistent
 * (DESIGN-SYSTEM.md §3 + §21).
 *
 * Honors `prefers-color-scheme` via the `useColorScheme()` hook from
 * react-native, and applies the active theme via React context so
 * every screen reads tokens from the same source.
 */

import * as React from "react";
import { useColorScheme } from "react-native";

export interface ThemePalette {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  surfaceInverse: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  accent: string;
  accentSoft: string;
  border: string;
  borderSubtle: string;
  danger: string;
  warning: string;
  success: string;
}

export interface ThemeFonts {
  sans: string;
  mono: string;
}

export interface Theme {
  colors: ThemePalette;
  fonts: ThemeFonts;
  isDark: boolean;
}

// Light — DESIGN-SYSTEM §24.1 light theme tokens.
const LIGHT: ThemePalette = {
  canvas: "#ECEFE6",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F1EA",
  surfaceInverse: "#0E0F12",
  ink: "#0E0F12",
  inkMuted: "#5C6068",
  inkFaint: "#8E929B",
  accent: "#FF5C44",
  accentSoft: "#FFE3DC",
  border: "rgba(14, 15, 18, 0.10)",
  borderSubtle: "rgba(14, 15, 18, 0.06)",
  danger: "#D62E2E",
  warning: "#C97A0F",
  success: "#1F9E5A",
};

// Dark — true dark, not OLED black.
const DARK: ThemePalette = {
  canvas: "#0E0F12",
  surface: "#18191C",
  surfaceMuted: "#222428",
  surfaceInverse: "#F4F1EA",
  ink: "#F4F1EA",
  inkMuted: "#B5B8BF",
  inkFaint: "#7A7E87",
  accent: "#FF5C44",
  accentSoft: "rgba(255, 92, 68, 0.18)",
  border: "rgba(255, 255, 255, 0.10)",
  borderSubtle: "rgba(255, 255, 255, 0.06)",
  danger: "#E57F7F",
  warning: "#F0C66E",
  success: "#5DD39E",
};

const FONTS: ThemeFonts = {
  sans: "Inter",
  mono: "JetBrains Mono",
};

const ThemeContext = React.createContext<Theme>({
  colors: LIGHT,
  fonts: FONTS,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const scheme = useColorScheme();
  const theme = React.useMemo<Theme>(
    () => ({
      colors: scheme === "dark" ? DARK : LIGHT,
      fonts: FONTS,
      isDark: scheme === "dark",
    }),
    [scheme],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}