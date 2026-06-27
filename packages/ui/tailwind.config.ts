import type { Config } from "tailwindcss";
import { fontStacks } from "./src/fonts";
import { radius, space } from "./src/tokens";

/**
 * Tailwind theme preset for ReadMaxxing — maps M-Chef design-system
 * tokens (DESIGN-SYSTEM.md §24.1, §24.2) into Tailwind's `theme.extend`
 * so consumers can write `bg-canvas`, `text-coral`, `rounded-lg`, etc.
 *
 * Inter is the only family (no Source Serif, no Atkinson Hyperlegible).
 * The focus ring is the coral halo from §19.2.
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
          "inverse-muted": "var(--text-inverse-muted)",
        },

        // Brand accents — DESIGN-SYSTEM §3.4.
        coral: {
          bg: "#FF5C44",
          soft: "#FFE3DC",
          text: "#C8341B",
          fg: "#FFFFFF",
        },
        butter: {
          bg: "#F5C84C",
          soft: "#FFEFC5",
          text: "#6B4F00",
          fg: "#0E0F12",
        },
        lavender: {
          bg: "#B5A6FF",
          soft: "#E4DDFF",
          text: "#4433B5",
          fg: "#FFFFFF",
        },
        mint: {
          bg: "#7FE3B0",
          soft: "#D6F5E5",
          text: "#1B6B45",
          fg: "#0E0F12",
        },

        // Legacy "accent" alias kept for backwards compat — maps to coral.
        accent: {
          DEFAULT: "#FF5C44",
          soft: "#FFE3DC",
          text: "#C8341B",
          focus: "rgba(255, 92, 68, 0.35)",
        },

        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
          inverse: "var(--border-inverse)",
        },

        // Semantic state colors — DESIGN-SYSTEM §3.5.
        success: "#1F9E5A",
        "success-soft": "#E5F6EC",
        warning: "#C97A0F",
        "warning-soft": "#FFF1DC",
        danger: "#D62E2E",
        "danger-soft": "#FCE4E4",
        info: "#2A5BD7",
        "info-soft": "#E2EAFB",
      },
      fontFamily: {
        sans: fontStacks.sans.split(", "),
        mono: fontStacks.mono.split(", "),
      },
      fontSize: {
        xs: ["11px", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        sm: ["13px", { lineHeight: "1.4" }],
        base: ["15px", { lineHeight: "1.5" }],
        md: ["17px", { lineHeight: "1.5" }],
        lg: ["20px", { lineHeight: "1.3" }],
        xl: ["28px", { lineHeight: "1.2" }],
        "2xl": ["36px", { lineHeight: "1.15" }],
        "3xl": ["48px", { lineHeight: "1.1" }],
        display: ["80px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        mega: ["120px", { lineHeight: "1.0", letterSpacing: "-0.04em" }],
      },
      borderRadius: {
        xs: radius.xs,
        sm: radius.sm,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        "2xl": radius["2xl"],
        full: radius.full,
      },
      spacing: {
        0: space[0],
        1: space[1],
        2: space[2],
        3: space[3],
        4: space[4],
        5: space[5],
        6: space[6],
        7: space[7],
        8: space[8],
        9: space[9],
        10: space[10],
        11: space[11],
        12: space[12],
      },
      maxWidth: {
        reading: "66ch",
      },
      transitionDuration: {
        instant: "80ms",
        fast: "150ms",
        base: "220ms",
        slow: "320ms",
        deliberate: "480ms",
        highlight: "120ms",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        in: "cubic-bezier(0.6, 0, 0.8, 0.2)",
        inout: "cubic-bezier(0.4, 0, 0.2, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(14, 15, 18, 0.04)",
        sm: "0 2px 6px rgba(14, 15, 18, 0.06), 0 1px 2px rgba(14, 15, 18, 0.04)",
        md: "0 6px 16px rgba(14, 15, 18, 0.08), 0 2px 4px rgba(14, 15, 18, 0.04)",
        lg: "0 12px 32px rgba(14, 15, 18, 0.12), 0 4px 8px rgba(14, 15, 18, 0.06)",
        xl: "0 24px 56px rgba(14, 15, 18, 0.18), 0 8px 16px rgba(14, 15, 18, 0.08)",
        // Coral focus ring — DESIGN-SYSTEM §19.2.
        focus: "0 0 0 3px rgba(255, 92, 68, 0.35)",
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