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
});