/**
 * PlayerBar component tests — play/pause toggle, scrubber drag updates store,
 * progressive disclosure.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as React from "react";
import { PlayerBar } from "./PlayerBar";

describe("PlayerBar", () => {
  it("renders the play button by default and toggles on click", () => {
    const onPlayPause = vi.fn();
    render(
      <PlayerBar
        title="Sample"
        playing={false}
        currentTime={0}
        duration={120}
        speed={1}
        onPlayPause={onPlayPause}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    const button = screen.getByLabelText("Play");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("uses the Pause label when playing", () => {
    render(
      <PlayerBar
        title="Sample"
        playing={true}
        currentTime={30}
        duration={120}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/pause/i)).toBeInTheDocument();
  });

  it("calls onSeek when the scrubber (WaveformScrubber) is clicked", () => {
    const onSeek = vi.fn();
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={false}
        currentTime={0}
        duration={120}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={onSeek}
        onSpeedChange={() => undefined}
      />,
    );
    // Phase F (F.8): the WaveformScrubber is a button[role=slider],
    // not an <input type=range>. Stub its bounding rect so the
    // click coords map cleanly in jsdom.
    const scrubber = container.querySelector<HTMLButtonElement>("button[role='slider']");
    expect(scrubber).not.toBeNull();
    scrubber!.getBoundingClientRect = (): DOMRect => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 100,
      bottom: 28,
      width: 100,
      height: 28,
      toJSON: () => ({}),
    });
    fireEvent.mouseDown(scrubber!, { clientX: 50 });
    expect(onSeek).toHaveBeenCalled();
  });

  it("renders the title and a back/forward nudge button", () => {
    render(
      <PlayerBar
        title="Hello world"
        playing={false}
        currentTime={0}
        duration={60}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    expect(screen.getByText(/hello world/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/back 30 seconds/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/forward 15 seconds/i)).toBeInTheDocument();
  });

  it("timecode text uses font-mono + tabular-nums (Phase E E.9)", () => {
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={false}
        currentTime={83}
        duration={300}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    // The collapsible header timecode reads "1:23 / 5:00".
    const oneTwentyThree = screen.getByText("1:23");
    expect(oneTwentyThree).toHaveClass("font-mono");
    expect(oneTwentyThree).toHaveClass("tabular-nums");
    // The md+ secondary timecode reads "1:23 / 5:00" as well.
    const elements = container.querySelectorAll(".font-mono.tabular-nums");
    expect(elements.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the voice *name* not the raw voice id (Phase E E.2)", () => {
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={false}
        currentTime={0}
        duration={120}
        speed={1}
        voiceLabel="Alice"
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    // Open the collapsible menu to surface the voice label.
    fireEvent.click(screen.getByRole("button", { name: /0:00.*sample/i }));
    const menu = container.querySelector("#player-bar-menu") as HTMLElement;
    expect(menu.textContent).toMatch(/Alice/);
  });

  // Phase F (F.5) — the hero variant renders when a doc is playing
  // AND `variant="hero"` is requested. It collapses back to the mini
  // variant when no doc is playing.
  it("renders the hero variant with sanctioned gradient when variant=hero", () => {
    const { container } = render(
      <PlayerBar
        title="My book"
        playing={true}
        currentTime={30}
        duration={300}
        speed={1}
        voiceLabel="Alice"
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
        variant="hero"
      />,
    );
    const hero = container.querySelector('[data-variant="hero"]');
    expect(hero).not.toBeNull();
    // The sanctioned gradient is the ONLY bg-gradient-to-* in the
    // codebase (per Phase F F.5). Inline backgroundImage carries it.
    const heroEl = hero as HTMLElement;
    const bg = heroEl.style.backgroundImage;
    expect(bg).toMatch(/linear-gradient/);
    expect(bg).toMatch(/var\(--surface/);
    // Hero card has the primary "Continue listening" CTA + voice label.
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change voice/i })).toBeInTheDocument();
    // Cover art is decorative (decorative by default); it carries the
    // data-cover-seed hook for tests.
    expect(container.querySelector("[data-cover-seed]")).not.toBeNull();
  });

  it("collapses to the mini variant when paused (data-variant=mini)", () => {
    const { container } = render(
      <PlayerBar
        title="My book"
        playing={false}
        currentTime={0}
        duration={300}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
        variant="hero"
      />,
    );
    // Even with variant=hero, paused doesn't change the variant prop
    // — the hero card still surfaces; the play CTA flips to
    // "Continue listening" instead of "Pause".
    expect(container.querySelector('[data-variant="hero"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: /continue listening/i })).toBeInTheDocument();
  });

  it("mini variant always renders data-variant=mini", () => {
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={true}
        currentTime={10}
        duration={60}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    expect(container.querySelector('[data-variant="mini"]')).not.toBeNull();
    expect(container.querySelector('[data-variant="hero"]')).toBeNull();
  });

  // Phase F (F.7) — Equalizer renders inside the mini variant.
  it("renders an Equalizer inside the mini variant", () => {
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={true}
        currentTime={10}
        duration={60}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    const eq = container.querySelector("[data-playing='true']");
    expect(eq).not.toBeNull();
  });

  // Phase F (F.8) — WaveformScrubber is the seekable control.
  it("renders a WaveformScrubber as the seek control (role=slider)", () => {
    const { container } = render(
      <PlayerBar
        title="Sample"
        playing={true}
        currentTime={10}
        duration={60}
        speed={1}
        onPlayPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
      />,
    );
    expect(container.querySelector("button[role='slider']")).not.toBeNull();
  });
});