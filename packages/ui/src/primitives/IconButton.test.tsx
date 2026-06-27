/**
 * IconButton primitive tests — circular, ≥44px default, three intents.
 *
 * Per DESIGN-SYSTEM §25.5:
 * - Pill or circle only — every icon button is `rounded-full`.
 * - Default height ≥44px for touch.
 * - Three intents (primary / secondary / ghost) render distinct styles.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("renders a circular button (rounded-full)", () => {
    render(<IconButton icon="check" aria-label="Confirm" />);
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveClass("rounded-full");
  });

  it("default size is md (44px tall — meets ≥44px touch target)", () => {
    render(<IconButton icon="check" aria-label="Confirm" />);
    const btn = screen.getByRole("button", { name: "Confirm" });
    expect(btn).toHaveClass("h-11"); // 44px
    expect(btn).toHaveClass("w-11");
  });

  it("renders 36/44/52 heights", () => {
    const { rerender } = render(<IconButton icon="check" aria-label="Confirm" size="sm" />);
    expect(screen.getByRole("button")).toHaveClass("h-9"); // 36px
    rerender(<IconButton icon="check" aria-label="Confirm" size="md" />);
    expect(screen.getByRole("button")).toHaveClass("h-11"); // 44px
    rerender(<IconButton icon="check" aria-label="Confirm" size="lg" />);
    expect(screen.getByRole("button")).toHaveClass("h-[3.25rem]"); // 52px
  });

  it("focusable via real <button> element + aria-label", () => {
    render(<IconButton icon="check" aria-label="Confirm" />);
    const btn = screen.getByRole("button", { name: "Confirm" });
    expect(btn.tagName).toBe("BUTTON");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("three intents render distinct classes", () => {
    const { rerender } = render(<IconButton icon="check" aria-label="Confirm" intent="primary" />);
    expect(screen.getByRole("button")).toHaveClass("bg-coral-bg");
    rerender(<IconButton icon="check" aria-label="Confirm" intent="secondary" />);
    expect(screen.getByRole("button")).toHaveClass("bg-card-muted");
    rerender(<IconButton icon="check" aria-label="Confirm" intent="ghost" />);
    expect(screen.getByRole("button")).toHaveClass("bg-transparent");
  });
});