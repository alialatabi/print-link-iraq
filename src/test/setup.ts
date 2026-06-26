import "@testing-library/jest-dom";

// ---------------------------------------------------------------------------
// Node.js 22+ localStorage/sessionStorage polyfill
//
// Node.js 22+ (and 26) exposes experimental `localStorage`/`sessionStorage`
// on globalThis as a getter that returns `undefined` when --localstorage-file
// is not provided. This shadows jsdom's window implementation and makes bare
// `localStorage` references in tests (and in tested code) return `undefined`.
//
// Since the Node.js property is `configurable: true`, we can redefine it with
// a real in-memory implementation via Object.defineProperty.
// ---------------------------------------------------------------------------

function makeStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => { store.set(key, String(value)); },
    removeItem: (key: string): void => { store.delete(key); },
    clear: (): void => { store.clear(); },
    get length(): number { return store.size; },
    key: (i: number): string | null => [...store.keys()][i] ?? null,
  } as unknown as Storage;
}

// Override only when the global is not already a real Storage object
if (!(globalThis.localStorage instanceof Object) || globalThis.localStorage === null || typeof globalThis.localStorage.getItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeStorageMock(),
    writable: true,
    configurable: true,
    enumerable: false,
  });
}
if (!(globalThis.sessionStorage instanceof Object) || globalThis.sessionStorage === null || typeof globalThis.sessionStorage?.getItem !== 'function') {
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: makeStorageMock(),
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null as null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
