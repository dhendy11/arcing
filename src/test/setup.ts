import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Testing Library is only loaded when a DOM exists, so node-environment
// tests never pull react-dom in through this file.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

// Node's own global localStorage (stable since Node 22.4) is not on
// vitest's jsdom global allowlist, so it shadows jsdom's real Storage
// instance: window.localStorage resolves to Node's stub, which has no
// clear() or key(). Repoint it at jsdom's actual Storage so a jsdom test
// that uses localStorage gets a real, working store.
if (typeof document !== "undefined") {
  const jsdomGlobal = (globalThis as unknown as { jsdom?: { window: { localStorage: Storage } } }).jsdom;
  if (jsdomGlobal && typeof globalThis.localStorage?.clear !== "function") {
    Object.defineProperty(globalThis, "localStorage", {
      value: jsdomGlobal.window.localStorage,
      configurable: true,
    });
  }
}
