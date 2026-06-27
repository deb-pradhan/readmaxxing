/**
 * StatusPill primitive tests — copy-stable, never lies.
 *
 * Per DESIGN-SYSTEM §25.8 + D15 (latency honesty):
 * - 'error' → "Failed" (never "come back later").
 * - Each status binds to a default tone.
 * - 'rendering' status carries an animated dot indicator.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { StatusPill } from "./StatusPill";

describe("StatusPill", () => {
  it("renders copy-stable labels for every status", () => {
    const cases: Array<["queued" | "rendering" | "ready" | "error" | "complete", string]> = [
      ["queued", "Queued"],
      ["rendering", "Rendering"],
      ["ready", "Ready"],
      ["error", "Failed"],
      ["complete", "Complete"],
    ];
    for (const [status, label] of cases) {
      const { unmount } = render(<StatusPill status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(label).closest("[data-status]")).toHaveAttribute("data-status", status);
      unmount();
    }
  });

  it("default tone maps to a status-appropriate semantic class", () => {
    const { rerender } = render(<StatusPill status="ready" />);
    // ready defaults to 'info' tone (bg-info-soft)
    expect(screen.getByText("Ready").parentElement).toHaveClass("bg-info-soft");

    rerender(<StatusPill status="complete" />);
    expect(screen.getByText("Complete").parentElement).toHaveClass("bg-success-soft");

    rerender(<StatusPill status="error" />);
    expect(screen.getByText("Failed").parentElement).toHaveClass("bg-danger-soft");
  });

  it("custom label overrides the default copy", () => {
    render(<StatusPill status="rendering" label="Transcribing…" />);
    expect(screen.getByText("Transcribing…")).toBeInTheDocument();
  });

  it("'rendering' status carries an animated dot", () => {
    const { container } = render(<StatusPill status="rendering" />);
    // The leading dot is the first child <span aria-hidden>.
    const dot = container.querySelector("span[aria-hidden='true']");
    expect(dot).toHaveClass("animate-pulse");
  });

  it("mono + uppercase styling (instrument-grade readout)", () => {
    render(<StatusPill status="ready" />);
    expect(screen.getByText("Ready").parentElement).toHaveClass("font-mono");
    expect(screen.getByText("Ready").parentElement).toHaveClass("uppercase");
  });
});