/**
 * VoicePicker — Phase 5 cloned-voice tests.
 *
 * The original component (Phase 2) is exercised in the web app. Here we
 * pin the new behaviors:
 *   - Cloned voices are surfaced at the top of the grid.
 *   - Cloned voices render the "Your voice" badge.
 *   - Marquee / non-cloned voices render the "Recommended" badge.
 */

import { describe, it, expect } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VoicePicker } from "./VoicePicker";

const VOICES = [
  { id: "eleven_rachel", name: "Rachel", isMarquee: true },
  { id: "eleven_josh", name: "Josh" },
  { id: "cloned:abc", name: "My voice", isCloned: true },
];

describe("VoicePicker", () => {
  it("surfaces cloned voices at the top with a 'Your voice' badge", () => {
    render(<VoicePicker voices={VOICES} value={null} onChange={() => {}} />);
    const cloned = screen.getByTestId("your-voice-badge");
    expect(cloned).toBeInTheDocument();
    expect(cloned.textContent).toBe("Your voice");
    // The cloned voice should be the first card in the grid (DOM order).
    const cards = screen.getAllByRole("button", { pressed: false });
    expect(cards[0]?.textContent).toContain("My voice");
  });

  it("renders the 'Recommended' badge for marquee voices", () => {
    render(<VoicePicker voices={VOICES} value={null} onChange={() => {}} />);
    expect(screen.getByText(/recommended/i)).toBeInTheDocument();
  });

  it("selects the matching voice", () => {
    render(<VoicePicker voices={VOICES} value="cloned:abc" onChange={() => {}} />);
    const pressed = screen.getAllByRole("button", { pressed: true });
    expect(pressed.length).toBe(1);
    expect(pressed[0]?.textContent).toContain("My voice");
  });

  // Phase F (F.6): the active voice card uses the peach row.
  it("the active voice card uses the peach row (bg-coral-100 + text-coral-700)", () => {
    const { container } = render(
      <VoicePicker voices={VOICES} value="cloned:abc" onChange={() => {}} />,
    );
    // The card wraps the button — find the card with the active class.
    const activeCard = container.querySelector(".bg-coral-100");
    expect(activeCard).not.toBeNull();
    expect(activeCard?.className).toContain("text-coral-700");
  });
});
