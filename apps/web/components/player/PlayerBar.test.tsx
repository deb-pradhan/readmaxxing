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

  it("calls onSeek when the scrubber fires pointerUp", () => {
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
    const scrubber = container.querySelector<HTMLInputElement>("input[type='range']");
    expect(scrubber).not.toBeNull();
    fireEvent.pointerUp(scrubber!);
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
});