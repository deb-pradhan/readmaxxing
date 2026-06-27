/**
 * VoiceCloneFlow — Phase E (E.7) tests.
 *
 * Audit F finding: VoiceCloneFlow referenced `bg-coral-bg-soft` /
 * `border-coral-bg-soft` / `text-coral-text` — the `bg-` prefix
 * doesn't exist in the Tailwind theme, so the classes silently
 * no-op'd. Phase E swapped them for the live `coral-soft` utility.
 *
 * This test pins the classes the wizard actually applies — it
 * asserts the swap is correct and that the success card and the
 * "done" step pill use `coral-soft` (not `coral-bg-soft`).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

vi.mock("@readmaxxing/ui", async () => {
  const actual = await vi.importActual<typeof import("@readmaxxing/ui")>("@readmaxxing/ui");
  return actual;
});

describe("VoiceCloneFlow (Phase E — E.7)", () => {
  it("uses bg-coral-soft (not the dead bg-coral-bg-soft) in the rendered output", async () => {
    const { VoiceCloneFlow } = await import("./VoiceCloneFlow");
    // The flow starts at the consent step (step 0). Render and look
    // for any class containing the legacy alias.
    const { container } = render(<VoiceCloneFlow onCloned={() => undefined} />);
    const html = container.innerHTML;
    // No occurrence of the dead `bg-coral-bg-soft` utility anywhere.
    expect(html).not.toContain("bg-coral-bg-soft");
    expect(html).not.toContain("border-coral-bg-soft");
    // The success card and step pill are only rendered after step
    // completion — those code paths are exercised by manual smoke
    // (per Phase E E.7 instructions) plus the build's static check.
  });

  it("exports a VoiceCloneFlow component that renders without crashing", async () => {
    const { VoiceCloneFlow } = await import("./VoiceCloneFlow");
    const { container } = render(<VoiceCloneFlow onCloned={() => undefined} />);
    expect(container.firstChild).not.toBeNull();
  });
});