// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, devices } from "@playwright/test";
import {
  DESKTOP_CHROMIUM_PROJECT_NAME,
  getConfiguredLighthouseBrowserPath,
  LIGHTHOUSE_DEBUG_PORT,
  shouldEnableLighthouseBrowser,
  shouldUseSingleWorker,
} from "./tests/e2e/performance-mode";
import {
  getConfiguredLiveWebPushBrowserPath,
  shouldEnableLiveWebPushBrowser,
} from "./tests/e2e/web-push-live-mode";
import {
  PREVIEW_BASE_URL,
  isRemotePlaywrightTarget,
  resolvePlaywrightAppSurface,
  resolvePlaywrightBaseUrl,
} from "./tests/e2e/target-urls";
import {
  getAppSurfaceMode,
  resolveAppSurface,
} from "./src/platform/appSurfaceContract";

const DEFAULT_LOCAL_ANDROID_E2E_BASE_URL = "http://localhost:4174";

function readTrimmedEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function resolveLocalDevServerCommand(
  baseUrl: string,
  appSurface: string
): string {
  const { hostname, port } = new URL(baseUrl);
  const mode = getAppSurfaceMode(resolveAppSurface(appSurface, false));

  return `cross-env VITE_APP_SURFACE=${appSurface} vite --mode ${mode} --host ${hostname} --port ${port || "80"} --strictPort`;
}

function resolveCiPreviewServerCommand(appSurface: string): string {
  const surface = resolveAppSurface(appSurface, false);

  return `cross-env VITE_APP_SURFACE=${surface} tsc && cross-env VITE_APP_SURFACE=${surface} vite build --mode preview && npm run preview`;
}

/**
 * Suppress the Node.js stderr warning:
 *   "The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set."
 *
 * Playwright unconditionally injects `FORCE_COLOR=1` (and `DEBUG_COLORS=1`)
 * into every worker and web-server child it spawns so its terminal output
 * stays colorized; see `WorkerHost` and `DEFAULT_ENVIRONMENT_VARIABLES`
 * in `node_modules/playwright/lib/runner/index.js`. When the parent shell
 * also exports `NO_COLOR` (common on Polyscope/CI sandboxes that disable
 * color globally), every spawned process inherits both variables and
 * Node's `tty.warnOnDeactivatedColors()` emits the warning on each one.
 *
 * `NO_COLOR` has no effect on Playwright runs in the first place because
 * Playwright always overrides it. Removing it (and the legacy
 * `NODE_DISABLE_COLORS`) from `process.env` before workers fork keeps the
 * runtime behaviour identical and silences the noise. See issue #1121.
 */
for (const name of ["NO_COLOR", "NODE_DISABLE_COLORS"] as const) {
  const value = process.env[name];
  if (value !== undefined) {
    delete process.env[name];
  }
}

/**
 * Playwright E2E Test Configuration
 *
 * Three modes of operation:
 *
 * 1. Local Development (default):
 *    - Uses a dedicated Android-surface Vite dev server
 *      (http://localhost:4174)
 *    - Forces the Android-native app surface by default so Android
 *      provisioning specs run against the route surface where that feature is
 *      registered, regardless of any parent-shell `VITE_APP_SURFACE`
 *    - Full authentication and API integration
 *    - Command: `npx playwright test`
 *
 * 2. Polyscope Workspace Preview (recommended for "live" suites):
 *    - Auto-detected from the Polyscope clone path
 *      (`~/.polyscope/clones/<id>/<workspace>`) or `POLYSCOPE_WORKSPACE=…`
 *    - Resolves to `https://frontend-<workspace>.preview.secpal.dev` (frontend)
 *      and `https://api-<workspace>.preview.secpal.dev` (API)
 *    - The API workspace's `DatabaseSeeder` deterministically provisions the
 *      seeded test users and organizational units that the live-only suites
 *      depend on (see issue #1199); pure live targets such as
 *      `app.secpal.dev` are intentionally not part of the Polyscope E2E
 *      surface any more.
 *    - Command: `npx playwright test` (inside the workspace clone)
 *
 * 3. CI Smoke Tests:
 *    - Uses Vite preview server (static build)
 *    - Forces the Android-native app surface by default for parity with the
 *      default local e2e route surface
 *    - No backend required (smoke tests only)
 *    - Command: `CI=true npx playwright test`
 *
 * @see https://playwright.dev/docs/test-configuration
 */

/**
 * Base URL Configuration
 *
 * Priority:
 * 1. Current Polyscope workspace preview: https://frontend-<workspace>.preview.secpal.dev
 * 2. Explicit PLAYWRIGHT_BASE_URL when no Polyscope workspace is active
 * 3. CI mode: http://localhost:4173 (preview server)
 * 4. Default: http://localhost:5173 (generic dev server with proxy)
 */
const BASE_URL = resolvePlaywrightBaseUrl();
const configuredPlaywrightBaseUrl = readTrimmedEnvValue(
  process.env.PLAYWRIGHT_BASE_URL
);
const LOCAL_E2E_BASE_URL =
  !process.env.CI &&
  !isRemotePlaywrightTarget(BASE_URL) &&
  configuredPlaywrightBaseUrl === undefined
    ? DEFAULT_LOCAL_ANDROID_E2E_BASE_URL
    : BASE_URL;

/**
 * Detect if we're running against a server that Playwright should NOT start
 * locally. `isRemotePlaywrightTarget` matches any `https://` target, which
 * covers the Polyscope workspace preview, which is served by an external
 * process that Playwright must not duplicate with its own `webServer`.
 */
const isRemoteTarget = isRemotePlaywrightTarget(BASE_URL);
const configuredAppSurface = resolvePlaywrightAppSurface();
const hasExplicitPlaywrightAppSurfaceOverride =
  readTrimmedEnvValue(process.env.PLAYWRIGHT_APP_SURFACE) !== undefined;

const usesSingleWorker = shouldUseSingleWorker();
const lighthouseExecutablePath = getConfiguredLighthouseBrowserPath();
const liveWebPushExecutablePath = getConfiguredLiveWebPushBrowserPath();

const chromiumLaunchOptions = (() => {
  const lighthouseEnabled = shouldEnableLighthouseBrowser();
  const liveWebPushEnabled = shouldEnableLiveWebPushBrowser();

  if (lighthouseEnabled && liveWebPushEnabled) {
    throw new Error(
      "PLAYWRIGHT_LIGHTHOUSE and PLAYWRIGHT_LIVE_WEB_PUSH cannot be enabled at the same time. " +
        "Run Lighthouse audits and the live Web Push smoke in separate invocations."
    );
  }

  const launchOptions: {
    args?: string[];
    executablePath?: string;
  } = {};

  if (lighthouseEnabled) {
    launchOptions.args = [`--remote-debugging-port=${LIGHTHOUSE_DEBUG_PORT}`];

    if (lighthouseExecutablePath !== undefined) {
      launchOptions.executablePath = lighthouseExecutablePath;
    }
  }

  if (liveWebPushEnabled && liveWebPushExecutablePath !== undefined) {
    launchOptions.executablePath = liveWebPushExecutablePath;
  }

  return Object.keys(launchOptions).length > 0 ? launchOptions : undefined;
})();

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
    baseURL: LOCAL_E2E_BASE_URL,

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
      name: DESKTOP_CHROMIUM_PROJECT_NAME,
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
  // - Remote target (Polyscope workspace preview or any other HTTPS host):
  //   no local server needed because an external process already serves it
  // - CI mode: builds and starts preview server automatically
  // - Local dev: reuses existing dev server on localhost:5173
  webServer: isRemoteTarget
    ? undefined
    : process.env.CI
      ? {
          command: resolveCiPreviewServerCommand(configuredAppSurface),
          env: {
            ...process.env,
            VITE_API_URL: PREVIEW_BASE_URL,
            VITE_APP_SURFACE: configuredAppSurface,
          },
          url: PREVIEW_BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
        }
      : {
          command: resolveLocalDevServerCommand(
            LOCAL_E2E_BASE_URL,
            configuredAppSurface
          ),
          env: {
            ...process.env,
            VITE_API_URL: "",
            VITE_APP_SURFACE: configuredAppSurface,
          },
          url: LOCAL_E2E_BASE_URL,
          reuseExistingServer: !hasExplicitPlaywrightAppSurfaceOverride,
          timeout: 30_000,
        },
});
