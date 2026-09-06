// Playwright harness: @playwright/test pinned exact, retries 0, and a
// webServer running `npm run dev` so the dev-only APP_E2E_AUTH gate is
// available (it double gates on NODE_ENV === "development", which next dev
// sets on its own, so it is dead in the standalone build).
//
// DATA_DIR is a fresh temp directory per run, so the flow never touches
// Drew's real arcs and never depends on what a previous run left behind.
//
// workers 1 and fullyParallel false: both projects drive the SAME dev server
// and the SAME DATA_DIR, and the flow creates an arc whose id is derived
// from today's date plus the reference. Running them at once would race on
// the id collision suffix.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;
const E2E_DATA_DIR = mkdtempSync(path.join(tmpdir(), "arcing-e2e-"));

export default defineConfig({
  testDir: "./e2e",
  retries: 0,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      // 1024x768 with touch. The spec's iPad Safari target; Playwright runs
      // this preset on WebKit, which is the point of having it.
      name: "ipad",
      use: { ...devices["iPad Mini landscape"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_E2E_AUTH: "1",
      SESSION_SECRET: "e2e-only-not-a-real-secret",
      DATA_DIR: E2E_DATA_DIR,
    },
  },
});
