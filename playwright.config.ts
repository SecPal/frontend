// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, devices } from "@playwright/test";
import {
  getConfiguredLighthouseBrowserPath,
  LIGHTHOUSE_DEBUG_PORT,
  PREVIEW_BASE_URL,
  shouldEnableLighthouseBrowser,
  shouldUseSingleWorker,
} from "./tests/e2e/performance-mode";

/**
 * Playwright E2E Test Configuration
 *
 * Three modes of operation:
 *
 * 1. Local Development (default):
 *    - Uses Vite dev server (http://localhost:5173)
 *    - Uses the repository's current Vite/API wiring for local development
 *    - Full authentication and API integration
 *    - Command: `npx playwright test`
 *
 * 2. Staging/Performance Tests:
 *    - Uses real staging server (https://app.secpal.dev)
 *    - Tests against production-like environment
 *    - Command: `PLAYWRIGHT_BASE_URL=https://app.secpal.dev npx playwright test`
 *
 * 3. CI Smoke Tests:
 *    - Uses Vite preview server (static build)
 *    - No backend required (smoke tests only)
 *    - Command: `CI=true npx playwright test`
 *
 * @see https://playwright.dev/docs/test-configuration
 */

/**
 * Base URL Configuration
 *
 * Priority:
 * 1. PLAYWRIGHT_BASE_URL env var (for staging: https://app.secpal.dev)
 * 2. CI mode: http://localhost:4173 (preview server)
 * 3. Default: http://localhost:5173 (dev server with proxy)
 */
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ||
  (process.env.CI ? PREVIEW_BASE_URL : "http://localhost:5173");

/**
 * Detect if we're running against a remote server
 * (staging/production - no local webServer needed)
 */
const isRemoteTarget =
  process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://") ?? false;

const usesSingleWorker = shouldUseSingleWorker();
const lighthouseExecutablePath = getConfiguredLighthouseBrowserPath();

const chromiumLaunchOptions = shouldEnableLighthouseBrowser()
  ? {
      args: [`--remote-debugging-port=${LIGHTHOUSE_DEBUG_PORT}`],
      ...(lighthouseExecutablePath !== undefined && {
        executablePath: lighthouseExecutablePath,
      }),
    }
  : undefined;

export default defineConfig({
  // Global setup - logs in once and saves session state
  globalSetup: "./tests/e2e/global-setup.ts",

  // Test directory
  testDir: "./tests/e2e",

  // Run tests in parallel for speed
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only (flaky tests should be fixed, not retried locally)
  retries: process.env.CI ? 2 : 0,

  // CI preview and Lighthouse audits share fixed external resources.
  workers: usesSingleWorker ? 1 : undefined,

  // Reporter configuration
  reporter: process.env.CI
    ? [
        ["html", { open: "never" }],
        ["list"],
        ["json", { outputFile: "test-results.json" }],
      ]
    : [["html", { open: "never" }], ["list"]],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure (helpful for debugging)
    video: "on-first-retry",
  },

  // Configure projects - Chromium only for performance consistency
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumLaunchOptions,
      },
    },
    // Mobile Chrome for responsive testing
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],

  // Timeout for each test (performance tests may take longer)
  timeout: 60_000,

  // Expect timeout for assertions
  expect: {
    timeout: 10_000,
  },

  // Web server configuration
  // - Remote target (staging): No local server needed
  // - CI mode: builds and starts preview server automatically
  // - Local dev: reuses existing dev server on localhost:5173
  webServer: isRemoteTarget
    ? undefined
    : process.env.CI
      ? {
          command: "npm run build -- --mode preview && npm run preview",
          env: {
            ...process.env,
            VITE_API_URL: PREVIEW_BASE_URL,
          },
          url: PREVIEW_BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : {
          command: "npm run dev",
          env: {
            ...process.env,
            VITE_API_URL: "",
          },
          url: "http://localhost:5173",
          reuseExistingServer: true, // Reuse if already running
          timeout: 30_000,
        },
});
