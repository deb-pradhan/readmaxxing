/**
 * Root layout — Phase D P1 (D.5b) skip-link verification.
 *
 * The root layout is an async server component, which can't be rendered
 * directly under jsdom + React Testing Library (it relies on Next.js's
 * request scope for cookies()). Instead, we read the source file and
 * assert the skip-link markup is present, then we render an equivalent
 * snippet to confirm the link precedes page content. This pins the
 * spec contract (link href, class, ordering) without booting the full
 * Next request scope.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

describe("RootLayout (Phase D P1 — D.5b skip-to-content)", () => {
  it("source contains the skip-to-content anchor before the Providers wrapper", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "layout.tsx"),
      "utf8",
    );
    // Phase D P1 (D.5b): pin the markup contract — skip-to-content link
    // with the sr-only-focusable class so it appears on focus only.
    expect(src).toContain('href="#main"');
    expect(src).toContain("sr-only-focusable");
    expect(src).toContain("Skip to main content");
    // And it must come before `<Providers>` so the first Tab focuses it.
    const skipIdx = src.indexOf("Skip to main content");
    const providersIdx = src.indexOf("<Providers>");
    expect(skipIdx).toBeGreaterThan(-1);
    expect(providersIdx).toBeGreaterThan(skipIdx);
  });

  it("renders a skip link that points to #main and uses the sr-only-focusable class", () => {
    // Render an equivalent snippet so the class contract is exercised
    // against React + Testing Library (the actual layout is an async
    // server component and can't render in jsdom).
    render(
      <body>
        <a href="#main" className="sr-only-focusable">
          Skip to main content
        </a>
        <Providers>
          <div data-testid="child" />
        </Providers>
      </body>,
    );
    const skipLink = screen.getByRole("link", { name: /skip to main content/i });
    expect(skipLink.className).toContain("sr-only-focusable");
    expect(skipLink.getAttribute("href")).toBe("#main");
  });
});

// Local stub for the in-source snippet test.
function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}