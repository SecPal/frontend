// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  detectPolyscopeWorkspaceName,
  isRemotePlaywrightTarget,
  isWorkspacePreviewTarget,
  resolvePlaywrightBaseUrl,
} from "./target-urls";

export const LIGHTHOUSE_DEBUG_PORT = 9222;
export const LIGHTHOUSE_BROWSER_PATH_ENV_VAR = "CHROME_PATH";
export const DESKTOP_CHROMIUM_PROJECT_NAME = "chromium";

export const DEFAULT_LIGHTHOUSE_THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  "best-practices": 90,
} as const;

export const LIVE_LIGHTHOUSE_THRESHOLDS = {
  ...DEFAULT_LIGHTHOUSE_THRESHOLDS,
  performance: 85,
} as const;

type PerformanceAuditMode = {
  baseUrl: string;
  skipReason?: string;
};

const hasExplicitLighthouseMode = () =>
  process.env.PLAYWRIGHT_LIGHTHOUSE === "1";

const hasExplicitPlaywrightBaseUrl = () =>
  Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());

const hasPerformanceAuditTarget = () =>
  Boolean(process.env.CI) ||
  hasExplicitPlaywrightBaseUrl() ||
  detectPolyscopeWorkspaceName() !== undefined;

const isPlaywrightBundledChromiumPath = (browserPath: string) =>
  /(^|[/\\])ms-playwright([/\\]|$)/.test(browserPath);

export const getConfiguredLighthouseBrowserPath = () => {
  const browserPath = process.env[LIGHTHOUSE_BROWSER_PATH_ENV_VAR]?.trim();

  return browserPath ? browserPath : undefined;
};

export const getPerformanceAuditThresholds = (
  baseUrl = resolvePlaywrightBaseUrl()
) =>
  // Only Polyscope workspace previews receive the relaxed threshold; localhost
  // targets keep the stricter default so they don't mask regressions that CI
  // would catch.
  isWorkspacePreviewTarget(baseUrl)
    ? LIVE_LIGHTHOUSE_THRESHOLDS
    : DEFAULT_LIGHTHOUSE_THRESHOLDS;

export const shouldEnableLighthouseBrowser = () => hasExplicitLighthouseMode();

export const shouldUseSingleWorker = () =>
  Boolean(process.env.CI) || hasExplicitLighthouseMode();

export const getPerformanceAuditProjectSkipReason = (
  projectName: string,
  browserName: string
) => {
  if (browserName !== DESKTOP_CHROMIUM_PROJECT_NAME) {
    return "Lighthouse only works with Chromium";
  }

  if (projectName !== DESKTOP_CHROMIUM_PROJECT_NAME) {
    return "Lighthouse audits only run in the desktop chromium project because mobile-chrome does not expose the fixed CDP port.";
  }

  return undefined;
};

export const getPerformanceAuditMode = (): PerformanceAuditMode => {
  const baseUrl = resolvePlaywrightBaseUrl();

  if (!hasPerformanceAuditTarget()) {
    return {
      baseUrl,
      skipReason:
        "Performance audits require CI preview or an explicit PLAYWRIGHT_BASE_URL target.",
    };
  }

  if (!hasExplicitLighthouseMode()) {
    return {
      baseUrl,
      skipReason:
        "Performance audits require PLAYWRIGHT_LIGHTHOUSE=1 so Chromium exposes the Lighthouse CDP port.",
    };
  }

  if (
    isRemotePlaywrightTarget(baseUrl) &&
    process.env.PLAYWRIGHT_LIVE_LIGHTHOUSE !== "1"
  ) {
    return {
      baseUrl,
      skipReason:
        "Live Lighthouse audits require PLAYWRIGHT_LIVE_LIGHTHOUSE=1 until issue #957 is resolved.",
    };
  }

  if (isRemotePlaywrightTarget(baseUrl)) {
    const browserPath = getConfiguredLighthouseBrowserPath();

    if (!browserPath) {
      return {
        baseUrl,
        skipReason: `Live Lighthouse audits against ${baseUrl} require ${LIGHTHOUSE_BROWSER_PATH_ENV_VAR} to point to a stable Chrome/Chromium binary because the bundled Playwright Chromium snapshot does not support live HTTPS targets.`,
      };
    }

    if (isPlaywrightBundledChromiumPath(browserPath)) {
      return {
        baseUrl,
        skipReason: `Live Lighthouse audits require ${LIGHTHOUSE_BROWSER_PATH_ENV_VAR} to point to a stable Chrome/Chromium binary instead of the bundled Playwright Chromium snapshot.`,
      };
    }
  }

  return { baseUrl, skipReason: undefined };
};
