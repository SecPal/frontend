// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, devices } from "@playwright/test";
import { scrubPlaywrightColorEnvironment } from "./tests/e2e/playwright-color-environment";

scrubPlaywrightColorEnvironment();

const containerBaseUrl = process.env.SECPAL_CONTAINER_BASE_URL;

if (!containerBaseUrl) {
  throw new Error(
    "SECPAL_CONTAINER_BASE_URL must be set by scripts/container-browser.sh."
  );
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "container.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: containerBaseUrl,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "container-chromium",
      use: devices["Desktop Chrome"],
    },
  ],
});
