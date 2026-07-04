// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { DESKTOP_CHROMIUM_PROJECT_NAME } from "./performance-mode";
import {
  isWorkspacePreviewTarget,
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

  if (!isWorkspacePreviewTarget(baseUrl)) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason:
        "Live browser Web Push smoke only runs against the current Polyscope workspace preview (frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface.",
    };
  }

  if (!hasExplicitLiveWebPushMode()) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason:
        "Live browser Web Push smoke requires PLAYWRIGHT_LIVE_WEB_PUSH=1 to avoid accidental registration changes on the workspace preview.",
    };
  }

  if (!apiBaseUrl) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason: `Live browser Web Push smoke could not resolve the API origin for ${baseUrl}. The Polyscope workspace preview should expose api-<workspace>.preview.secpal.dev automatically; set PLAYWRIGHT_API_BASE_URL only if you intentionally override it.`,
    };
  }

  const browserPath = getConfiguredLiveWebPushBrowserPath();

  if (!browserPath) {
    return {
      baseUrl,
      apiBaseUrl,
      skipReason: `Live browser Web Push smoke against ${baseUrl} requires ${LIVE_WEB_PUSH_BROWSER_PATH_ENV_VAR} to point to a stable Chrome/Chromium binary because the bundled Playwright Chromium snapshot denies notification permission on HTTPS targets.`,
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
