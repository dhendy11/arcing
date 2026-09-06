import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Testing Library is only loaded when a DOM exists, so node-environment
// tests never pull react-dom in through this file.
afterEach(async () => {
  if (typeof document === "undefined") return;
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});
