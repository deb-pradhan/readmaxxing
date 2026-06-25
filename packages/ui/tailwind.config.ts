import type { Config } from "tailwindcss";
import { fontStacks } from "./src/fonts";
import { fluidBody, measure } from "./src/tokens";

/**
 * Tailwind theme preset for ReadMaxxing — maps tokens into Tailwind's
 * `theme.extend` so the consuming app can write `bg-surface-canvas`,
 * `text-text-primary`, etc.
 */
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../apps/web/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "16px",
        md: "24px",
      },
    },
    extend: {
      colors: {
        canvas: "var(--surface-canvas)",
        card: "var(--surface-card)",
        "card-muted": "var(--surface-muted)",
        elevated: "var(--surface-elevated)",
        inverse: "var(--surface-inverse)",
        overlay: "var(--surface-overlay)",

        ink: {
          DEFAULT: "var(--text-primary)",
          muted: "var(--text-secondary)",
          faint: "var(--text-tertiary)",
          inverse: "var(--text-inverse)",
        },

        accent: {
          DEFAULT: "#5B4DEF",
          soft: "rgba(91, 77, 239, 0.12)",
          strong: "rgba(91, 77, 239, 0.28)",
          focus: "rgba(91, 77, 239, 0.45)",
        },

        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },

        success: "#1F8E4A",
        warning: "#C97A0F",
        danger: "#D23838",
        info: "#2A5BD7",
      },
      fontFamily: {
        sans: fontStacks.sans.split(", "),
        serif: fontStacks.serif.split(", "),
        dyslexia: fontStacks.dyslexia.split(", "),
        mono: fontStacks.mono.split(", "),
      },
      fontSize: {
        xs: ["11px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        sm: ["13px", { lineHeight: "1.45" }],
        base: ["16px", { lineHeight: "1.55" }],
        md: ["18px", { lineHeight: "1.55" }],
        lg: ["22px", { lineHeight: "1.45" }],
        xl: ["28px", { lineHeight: "1.3" }],
        "2xl": ["36px", { lineHeight: "1.2" }],
        "3xl": ["48px", { lineHeight: "1.15" }],
        display: ["72px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        body: [fluidBody, { lineHeight: "1.6" }],
      },
      borderRadius: {
        xs: "6px",
        sm: "10px",
        md: "14px",
        lg: "20px",
        xl: "28px",
        full: "9999px",
      },
      spacing: {
        0: "0",
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        7: "32px",
        8: "40px",
        9: "48px",
        10: "64px",
        11: "80px",
        12: "96px",
      },
      maxWidth: {
        reading: measure,
      },
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        base: "220ms",
        slow: "320ms",
        highlight: "120ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        in: "cubic-bezier(0.6, 0, 0.8, 0.2)",
        inout: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(14, 14, 16, 0.04)",
        sm: "0 2px 6px rgba(14, 14, 16, 0.06)",
        md: "0 6px 16px rgba(14, 14, 16, 0.08)",
        lg: "0 12px 32px rgba(14, 14, 16, 0.12)",
        xl: "0 24px 56px rgba(14, 14, 16, 0.18)",
        focus: "0 0 0 3px rgba(91, 77, 239, 0.45)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.2s linear infinite",
        fadeIn: "fadeIn 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;