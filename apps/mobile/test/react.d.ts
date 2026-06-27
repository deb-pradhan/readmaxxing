/**
 * Stub for `react` types — the mobile app's `lib/auth.test.ts`
 * imports `React` for the render probe, but we don't install the
 * full react/react-dom tree in CI (the heavy deps come in via
 * `expo prebuild`). The real types ship once the user installs.
 *
 * IMPORTANT: this stub only declares what the mobile app's tests
 * need. The packages/ui + packages/core TypeScript sources use the
 * *real* `react` types installed in their own `node_modules`, so
 * the global stub here doesn't pollute the shared packages' tsc
 * output — it only matters when typechecking the mobile app, which
 * already happens with its own `tsconfig.json`.
 */

declare module "react" {
  export interface ReactNode {}
  export interface ReactElement {
    type: unknown;
    props: unknown;
    key: string | null;
  }
  export function createElement(
    type: unknown,
    props?: unknown,
    ...children: unknown[]
  ): ReactElement;
  export const Fragment: unknown;
  export const StrictMode: unknown;
  const React: {
    createElement: typeof createElement;
    Fragment: unknown;
    StrictMode: unknown;
  };
  export default React;
  export as namespace React;
}

declare module "@testing-library/react" {
  export function render(ui: unknown): { unmount(): void };
  export function waitFor(cb: () => void | Promise<void>, opts?: { timeout?: number }): Promise<void>;
  export function act<T>(cb: () => Promise<T> | T): Promise<T>;
}
