// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, devices } from "@playwright/test";
import { scrubPlaywrightColorEnvironment } from "./tests/e2e/playwright-color-environment";

scrubPlaywrightColorEnvironment();

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "container.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4176",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "container-chromium",
      use: devices["Desktop Chrome"],
    },
  ],
  webServer: {
    command: "bash ./scripts/run-frontend-container-test-server.sh",
    url: "http://127.0.0.1:4176/health/live",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
