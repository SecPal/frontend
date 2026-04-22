// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export const PREVIEW_BASE_URL = "http://localhost:4173";
export const LIGHTHOUSE_DEBUG_PORT = 9222;
export const LIGHTHOUSE_BROWSER_PATH_ENV_VAR = "CHROME_PATH";

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

const isLiveHttpsTarget = (baseUrl: string) => baseUrl.startsWith("https://");

const isPlaywrightBundledChromiumPath = (browserPath: string) =>
  /(^|[/\\])ms-playwright([/\\]|$)/.test(browserPath);

export const getConfiguredLighthouseBrowserPath = () => {
  const browserPath = process.env[LIGHTHOUSE_BROWSER_PATH_ENV_VAR]?.trim();

  return browserPath ? browserPath : undefined;
};

export const getPerformanceAuditThresholds = (
  baseUrl = process.env.PLAYWRIGHT_BASE_URL ||
    (process.env.CI ? PREVIEW_BASE_URL : "")
) =>
  isLiveHttpsTarget(baseUrl)
    ? LIVE_LIGHTHOUSE_THRESHOLDS
    : DEFAULT_LIGHTHOUSE_THRESHOLDS;

export const shouldEnableLighthouseBrowser = () => hasExplicitLighthouseMode();

export const shouldUseSingleWorker = () =>
  Boolean(process.env.CI) || hasExplicitLighthouseMode();

export const getPerformanceAuditMode = (): PerformanceAuditMode => {
  const baseUrl =
    process.env.PLAYWRIGHT_BASE_URL || (process.env.CI ? PREVIEW_BASE_URL : "");

  if (!baseUrl) {
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
    isLiveHttpsTarget(baseUrl) &&
    process.env.PLAYWRIGHT_LIVE_LIGHTHOUSE !== "1"
  ) {
    return {
      baseUrl,
      skipReason:
        "Live Lighthouse audits require PLAYWRIGHT_LIVE_LIGHTHOUSE=1 until issue #957 is resolved.",
    };
  }

  if (isLiveHttpsTarget(baseUrl)) {
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
