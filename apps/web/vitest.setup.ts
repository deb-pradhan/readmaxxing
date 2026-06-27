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

// Polyfill HTMLDialogElement.showModal / .close / .open for jsdom.
// The native `<dialog>` element is supported by jsdom but the modal
// API methods (`showModal`, `close`, and the `open` property setter)
// are missing in older jsdom builds. Phase E E.4's `ConfirmDialog`
// (and the existing `CommandPalette` / `KeyboardShortcuts`) depend
// on these — without the polyfill, every dialog opens as a plain
// inline element and the focus-management tests fail.
if (typeof HTMLDialogElement !== "undefined") {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement & {
    showModal?: () => void;
    close?: (returnValue?: string) => void;
  };
  if (typeof proto.showModal !== "function") {
    proto.showModal = function showModal(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    };
  }
  if (typeof proto.close !== "function") {
    proto.close = function close(this: HTMLDialogElement): void {
      this.removeAttribute("open");
    };
  }
}