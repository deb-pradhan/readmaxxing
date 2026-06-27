/**
 * Design tokens — Visual Language v2 contract.
 *
 * Pins the values referenced across the design system (DESIGN-SYSTEM §25):
 * - v2 radius shape language (thumb/card/tile/sheet/squircle/pill).
 * - v2 elevation scale (elev-1/2/3) + `soft` legacy alias.
 * - v2 mono font stack (Geist Mono first).
 * - Legacy aliases (sm/md/lg/xl/2xl/full) remain so existing imports
 *   don't break for one release.
 */

import { describe, it, expect } from "vitest";
import {
  elevation,
  font,
  hairline,
  radius,
} from "./tokens";

describe("v2 radius tokens", () => {
  it("ships the v2 shape language values", () => {
    expect(radius.thumb).toBe("12px");
    expect(radius.card).toBe("20px");
    expect(radius.tile).toBe("24px");
    expect(radius.sheet).toBe("28px");
    expect(radius.squircle).toBe("22px");
    expect(radius.pill).toBe("9999px");
    expect(radius.circle).toBe("50%");
  });

  it("keeps legacy aliases for one release", () => {
    expect(radius.xs).toBe("6px");
    expect(radius.sm).toBe("10px");
    expect(radius.md).toBe("16px");
    expect(radius.lg).toBe("20px");
    expect(radius.xl).toBe("28px");
    expect(radius["2xl"]).toBe("36px");
    expect(radius.full).toBe("9999px");
  });
});

describe("v2 elevation tokens", () => {
  it("defines the elev-1/2/3 scale + soft legacy alias", () => {
    expect(elevation["elev-1"]).toBeTruthy();
    expect(elevation["elev-2"]).toBeTruthy();
    expect(elevation["elev-3"]).toBeTruthy();
    expect(typeof elevation["elev-1"]).toBe("string");
    expect(elevation["elev-1"].length).toBeGreaterThan(0);
  });

  it("`soft` aliases elev-2 (fixes the prior undefined `shadow-soft`)", () => {
    expect(elevation.soft).toBe(elevation["elev-2"]);
  });
});

describe("v2 hairline tokens", () => {
  it("defines subtle + strong hairlines", () => {
    expect(hairline.subtle).toBe("rgba(14,15,18,.08)");
    expect(hairline.strong).toBe("rgba(14,15,18,.16)");
  });
});

describe("v2 font tokens", () => {
  it("mono stack leads with Geist Mono then JetBrains Mono", () => {
    expect(font.mono).toContain("Geist Mono");
    expect(font.mono).toContain("JetBrains Mono");
    // Geist Mono must come first.
    expect(font.mono.indexOf("Geist Mono")).toBeLessThan(
      font.mono.indexOf("JetBrains Mono"),
    );
  });

  it("sans stack keeps Inter as the only display family", () => {
    expect(font.sans).toContain("Inter");
  });
});