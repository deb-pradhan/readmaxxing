import "@testing-library/jest-dom/vitest";

// Polyfill AudioContext for jsdom — Player tests instantiate the engine.
declare global {
  interface Window {
    AudioContext?: typeof AudioContext;
  }
}
if (typeof window !== "undefined" && typeof window.AudioContext === "undefined") {
  // jsdom doesn't provide AudioContext — the audio engine never touches it in
  // tests because we always inject a NullAudioContext factory.
}

// Polyfill ResizeObserver for `cmdk` (the Command palette library uses it
// to track the visible list item for keyboard nav). jsdom doesn't provide
// this by default; without the polyfill, opening the CommandPalette
// crashes the test. Phase D P1 — D.5a tests rely on this.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub;
}

// Polyfill Element.scrollIntoView for `cmdk` (it auto-scrolls the active
// list item into view). jsdom defines the method on the prototype but
// some build paths leave it as undefined; guard at instance level too.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    /* jsdom no-op */
  };
}