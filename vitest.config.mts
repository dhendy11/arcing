import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig's "@/*" -> "src/*"; vitest does not read tsconfig paths.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Node is the default. Component test files opt into a DOM with the
    // first-line docblock "// @vitest-environment jsdom".
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
