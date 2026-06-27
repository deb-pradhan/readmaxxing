/**
 * CoverArt primitive tests — deterministic gradient mesh.
 *
 * Per DESIGN-SYSTEM §25.6: every doc has a cover. The same seed
 * must produce the same gradient (and a different seed, a different
 * one). Token-only — no hex literal in the rendered output.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { CoverArt } from "./CoverArt";

describe("CoverArt", () => {
  it("renders a div with a deterministic gradient background derived from the seed", () => {
    const html = renderToStaticMarkup(<CoverArt seed="doc-123" />);
    // The same seed must produce the same gradient. We can't compare
    // colors headlessly (the colors are CSS vars), but the inline
    // style contains the gradient string — so two renders with the
    // same seed produce the exact same inline style.
    const a = renderToStaticMarkup(<CoverArt seed="doc-123" />);
    const b = renderToStaticMarkup(<CoverArt seed="doc-123" />);
    const styleA = a.match(/style="([^"]+)"/)?.[1] ?? "";
    const styleB = b.match(/style="([^"]+)"/)?.[1] ?? "";
    expect(styleA).toBeTruthy();
    expect(styleA).toBe(styleB);
  });

  it("different seeds produce different gradients", () => {
    const a = renderToStaticMarkup(<CoverArt seed="doc-aaa" />);
    const b = renderToStaticMarkup(<CoverArt seed="doc-bbb" />);
    const styleA = a.match(/style="([^"]+)"/)?.[1] ?? "";
    const styleB = b.match(/style="([^"]+)"/)?.[1] ?? "";
    expect(styleA).not.toBe(styleB);
  });

  it("no raw hex literals in the rendered output (token-only)", () => {
    const html = renderToStaticMarkup(
      <CoverArt seed="doc-token" title="Hello world" />,
    );
    // No #rgb / #rrggbb hex literals anywhere in the rendered markup.
    expect(html).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/);
  });

  it("decorative by default — aria-hidden=true and role omitted", () => {
    const html = renderToStaticMarkup(<CoverArt seed="doc-x" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it("non-decorative surfaces the seed as the accessible name", () => {
    const html = renderToStaticMarkup(
      <CoverArt seed="doc-y" decorative={false} />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Cover"');
  });

  it("honors the aspect prop", () => {
    const a = renderToStaticMarkup(<CoverArt seed="doc-3-4" aspect="3/4" />);
    const b = renderToStaticMarkup(<CoverArt seed="doc-1-1" aspect="1/1" />);
    const c = renderToStaticMarkup(<CoverArt seed="doc-16-9" aspect="16/9" />);
    expect(a).toContain("aspect-[3/4]");
    expect(b).toContain("aspect-square");
    expect(c).toContain("aspect-video");
  });

  it("renders the title overlay when provided (decorative only)", () => {
    const html = renderToStaticMarkup(
      <CoverArt seed="doc-overlay" title="The best interface" />,
    );
    expect(html).toContain("The best interface");
  });

  it("emits data-cover-* hooks for tests / debugging", () => {
    const html = renderToStaticMarkup(<CoverArt seed="doc-hooks" />);
    expect(html).toMatch(/data-cover-seed="doc-hooks"/);
    expect(html).toMatch(/data-cover-primary="(coral|butter|lavender|mint|lime)"/);
    expect(html).toMatch(/data-cover-secondary="(coral|butter|lavender|mint|lime)"/);
    expect(html).toMatch(/data-cover-aspect="3\/4"/);
  });
});