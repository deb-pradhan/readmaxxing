/**
 * Vite-style `?url` suffix — declares that the string import resolves to
 * a static asset URL at build time. The actual resolution happens in
 * `vite.config.ts` / `next.config.ts` (handled via `transpilePackages`).
 */
declare module "*?url" {
  const src: string;
  export default src;
}

/** pdfjs-dist worker — typed shim. Next/Turbopack doesn't support `?url`
 *  suffixes on dynamic imports; we resolve via fetch at runtime instead. */
declare module "*pdf.worker*" {
  const src: string;
  export default src;
}

/** Stub globals — keeps the reader page compiling in narrower DOM envs. */
declare global {
  interface Window {
    requestIdleCallback?: (cb: () => void) => number;
    cancelIdleCallback?: (id: number) => void;
  }
}
export {};