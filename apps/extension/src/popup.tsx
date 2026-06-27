/**
 * Popup entry — React app mounted by `manifest.json:action.default_popup`.
 *
 * The popup is a *small* companion to the overlay: the library list,
 * voice picker shortcut, recent docs, and a deep-link to the full web
 * app. The overlay (injected by `content.ts`) is where playback + the
 * karaoke highlighter live — those primitives are too big to render
 * inside the popup's constrained 360×600 frame.
 */

import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./popup.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("ReadMaxxing popup: missing #root element.");
}
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
