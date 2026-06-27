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