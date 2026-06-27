/**
 * Theme CSS variables — Visual Language v2 (§25) + UI-UX-AUDIT §B/C.
 *
 * Pins the contract that lets Tailwind utilities like `bg-coral-500/40`
 * compose alpha (because the coral ramp is emitted as RGB channels) and
 * that e-ink truly drops every accent to grayscale (UI-UX-AUDIT §C: the
 * prior audit verdict was that e-ink rendered full-saturation coral —
 * the v2 fix is accent CSS vars + grayscale remap, and this test
 * guards against any future regression).
 */

import { describe, it, expect } from "vitest";
import { themeCssVars, themes } from "./themes";

/**
 * Hex literal substrings that must NEVER appear in the e-ink theme's
 * emitted CSS vars. Coral-500 (#FF5C44) and butter (#F5C84C) are the
 * canonical "this is full-saturation coral/butter" hexes; if either
 * leaks into e-ink vars, the theme is broken.
 */
const EINK_FORBIDDEN_HEX = ["FF5C44", "F5C84C"];

describe("themeCssVars — Visual Language v2 contract", () => {
  it("e-ink emits no full-saturation coral/butter hex literals", () => {
    const vars = themeCssVars(themes.eink);
    const blob = JSON.stringify(vars).toUpperCase();
    for (const hex of EINK_FORBIDDEN_HEX) {
      expect(blob).not.toContain(hex);
    }
  });

  it("e-ink remaps coral-600 to a grayscale near-black", () => {
    const vars = themeCssVars(themes.eink);
    // Per DESIGN-SYSTEM §25.1, e-ink drops coral-600 to ~#1A1A1A.
    // We compare on the hex alias to keep the assertion stable across
    // alpha-channel formats.
    expect(vars["--coral-600-hex"]).toBe("#1A1A1A");
    expect(vars["--coral-100-hex"]).toBe("#E6E6E6");
  });

  it("light theme emits the full coral ramp + lime accent vars", () => {
    const vars = themeCssVars(themes.light);
    for (const key of [
      "--coral-500",
      "--coral-600",
      "--coral-700",
      "--coral-100",
      "--coral-soft",
      "--coral-text",
      "--lime-bg",
      "--lime-soft",
      "--lime-ink",
    ]) {
      expect(vars[key]).toBeDefined();
      expect(vars[key]).not.toBe("");
    }
  });

  it("dark theme emits the full coral ramp + lime accent vars", () => {
    const vars = themeCssVars(themes.dark);
    for (const key of [
      "--coral-500",
      "--coral-600",
      "--coral-700",
      "--coral-100",
      "--coral-soft",
      "--coral-text",
      "--lime-bg",
      "--lime-soft",
      "--lime-ink",
    ]) {
      expect(vars[key]).toBeDefined();
      expect(vars[key]).not.toBe("");
    }
  });

  it("sepia theme emits the full coral ramp + lime accent vars", () => {
    const vars = themeCssVars(themes.sepia);
    for (const key of [
      "--coral-500",
      "--coral-600",
      "--coral-700",
      "--coral-100",
      "--coral-soft",
      "--coral-text",
      "--lime-bg",
      "--lime-soft",
      "--lime-ink",
    ]) {
      expect(vars[key]).toBeDefined();
      expect(vars[key]).not.toBe("");
    }
  });

  it("emits per-theme ink + focus-ring vars", () => {
    const lightVars = themeCssVars(themes.light);
    const darkVars = themeCssVars(themes.dark);
    const einkVars = themeCssVars(themes.eink);
    expect(lightVars["--ink"]).toBe("#0E0F12");
    expect(darkVars["--ink"]).toBe("#F4F1EA");
    expect(einkVars["--ink"]).toBe("#000000");
    // E-ink must NOT use a coral focus ring (forced-colors safety).
    expect(einkVars["--focus-ring"]).not.toContain("255, 92, 68");
    expect(einkVars["--focus-ring"]).not.toContain("FF5C44");
  });

  it("preserves the original surface/text/border var names", () => {
    const vars = themeCssVars(themes.light);
    for (const key of [
      "--surface-canvas",
      "--surface-card",
      "--surface-muted",
      "--surface-elevated",
      "--surface-inverse",
      "--surface-overlay",
      "--text-primary",
      "--text-secondary",
      "--text-tertiary",
      "--border-subtle",
      "--border-default",
      "--border-strong",
      "--border-inverse",
      "--hover-tint",
    ]) {
      expect(vars[key]).toBeDefined();
      expect(vars[key]).not.toBe("");
    }
  });

  // Phase D P1 — contrast pass pins (audit §C.2).
  // We don't compute real WCAG contrast (overkill, and channel-based values
  // require a downstream color-mix), but we DO pin the two values the
  // design system relies on: tertiary text darkening + coral-600 ≠ coral-500.
  describe("contrast pass (Phase D P1 pins)", () => {
    it("light.textTertiary is the AA-safe #646871 (was #8E929B)", () => {
      expect(themes.light.textTertiary).toBe("#646871");
    });

    it("sepia.textTertiary is the AA-safe #75643F", () => {
      expect(themes.sepia.textTertiary).toBe("#75643F");
    });

    it("light coral-600 hex is distinct from coral-500 hex (CTA contrast)", () => {
      const vars = themeCssVars(themes.light);
      // --coral-500 is the hero/decorative fill; --coral-600 is the AA-safe
      // primary CTA fill. They must differ or the design contract breaks.
      expect(vars["--coral-500-hex"]).not.toBe(vars["--coral-600-hex"]);
      expect(vars["--coral-500-hex"]).toBe("#FF5C44");
      expect(vars["--coral-600-hex"]).toBe("#D83A22");
    });

    it("light coral-600 hex resolves to a non-empty CSS var", () => {
      const vars = themeCssVars(themes.light);
      expect(vars["--coral-600"]).toBeTruthy();
      expect(vars["--coral-600"].length).toBeGreaterThan(0);
    });
  });
});