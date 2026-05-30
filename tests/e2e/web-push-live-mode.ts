// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isRemoteE2ETarget } from "./auth-helpers";
import { DESKTOP_CHROMIUM_PROJECT_NAME } from "./performance-mode";
import {
  detectPolyscopeWorkspaceName,
  resolvePlaywrightApiBaseUrl,
  resolvePlaywrightBaseUrl,
} from "./target-urls";

export const LIVE_WEB_PUSH_MODE_ENV_VAR = "PLAYWRIGHT_LIVE_WEB_PUSH";
export const LIVE_WEB_PUSH_BROWSER_PATH_ENV_VAR = "CHROME_PATH";
const CHROMIUM_BROWSER_NAME = "chromium";

interface LiveWebPushMode {
  baseUrl: string;
  apiBaseUrl: string | undefined;
  skipReason?: string;
}

function hasExplicitLiveWebPushMode(): boolean {
  return process.env[LIVE_WEB_PUSH_MODE_ENV_VAR] === "1";
}

function hasExplicitPlaywrightBaseUrl(): boolean {
  return Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
}

function isPlaywrightBundledChromiumPath(browserPath: string): boolean {
  return /(^|[/\\])ms-playwright([/\\]|$)/.test(browserPath);
}

export function getConfiguredLiveWebPushBrowserPath(): string | undefined {
  const browserPath = process.env[LIVE_WEB_PUSH_BROWSER_PATH_ENV_VAR]?.trim();

  return browserPath ? browserPath : undefined;
}

export function shouldEnableLiveWebPushBrowser(): boolean {
  return hasExplicitLiveWebPushMode();
}

function hasLiveWebPushTarget(): boolean {
  return (
    hasExplicitPlaywrightBaseUrl() ||
    detectPolyscopeWorkspaceName() !== undefined
  );
}

export function getLiveWebPushProjectSkipReason(
  projectName: string,
  browserName: string
): string | undefined {
  if (browserName !== CHROMIUM_BROWSER_NAME) {
    return "Live browser Web Push smoke only works with Chromium";
  }

  if (projectName !== DESKTOP_CHROMIUM_PROJECT_NAME) {
    return "Live browser Web Push smoke only runs in the desktop chromium project because notification permission and push subscription diagnostics are only collected there.";
  }

  return undefined;
}

export function getLiveWebPushMode(): LiveWebPushMode {
  const baseUrl = resolvePlaywrightBaseUrl();
  const apiBaseUrl = resolvePlaywrightApiBaseUrl();

  if (!hasLiveWebPushTarget() || !isRemoteE2ETarget(baseUrl)) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason:
        "Live browser Web Push smoke requires an HTTPS deployment target via PLAYWRIGHT_BASE_URL or the current Polyscope workspace preview.",
    };
  }

  if (!hasExplicitLiveWebPushMode()) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason:
        "Live browser Web Push smoke requires PLAYWRIGHT_LIVE_WEB_PUSH=1 to avoid accidental registration changes on shared deployments.",
    };
  }

  if (!apiBaseUrl) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason: `Live browser Web Push smoke could not resolve the API origin for ${baseUrl}. Set PLAYWRIGHT_API_BASE_URL to the matching HTTPS API deployment.`,
    };
  }

  const browserPath = getConfiguredLiveWebPushBrowserPath();

  if (!browserPath) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason: `Live browser Web Push smoke against ${baseUrl} requires ${LIVE_WEB_PUSH_BROWSER_PATH_ENV_VAR} to point to a stable Chrome/Chromium binary because the bundled Playwright Chromium snapshot denies notification permission on live HTTPS targets.`,
    };
  }

  if (isPlaywrightBundledChromiumPath(browserPath)) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason: `Live browser Web Push smoke requires ${LIVE_WEB_PUSH_BROWSER_PATH_ENV_VAR} to point to a stable Chrome/Chromium binary instead of the bundled Playwright Chromium snapshot.`,
    };
  }

  return {
    baseUrl,
    apiBaseUrl,
    skipReason: undefined,
  };
}
