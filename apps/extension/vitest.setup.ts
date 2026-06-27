/**
 * Vitest setup — stub `chrome.*` APIs so the extension modules can be
 * loaded in jsdom. We don't need full implementations for the unit
 * tests; the contract is just "the modules import without throwing."
 */

const fakeChrome = {
  runtime: {
    sendMessage: () => undefined,
    onMessage: { addListener: () => undefined, removeListener: () => undefined },
    onInstalled: { addListener: () => undefined },
    getURL: (path: string) => `chrome-extension://test/${path}`,
    id: "test-extension-id",
  },
  tabs: {
    query: async () => [],
    sendMessage: async () => ({ ok: true }),
    create: async () => ({ id: 1 }),
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => undefined,
      remove: async () => undefined,
    },
    onChanged: {
      addListener: () => undefined,
      removeListener: () => undefined,
    },
  },
  scripting: {
    executeScript: async () => [],
  },
  commands: {
    onCommand: { addListener: () => undefined },
  },
  identity: {},
};

// We assign to globalThis as `chrome` — jsdom doesn't ship the type.
// Cast to `unknown` first to avoid the `chrome` namespace check.
(globalThis as unknown as { chrome: typeof fakeChrome }).chrome = fakeChrome;
