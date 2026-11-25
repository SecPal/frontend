// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parsePreviewHostname } from "../../src/previewHostname.ts";
import {
  resolveAppSurface,
  type AppSurface,
} from "../../src/platform/appSurfaceContract.ts";

const DEFAULT_LOCAL_BASE_URL = "http://localhost:5173";

export const PREVIEW_BASE_URL = "http://localhost:4173";

function readTrimmedEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

export function resolvePlaywrightBaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string {
  return (
    readTrimmedEnvValue(env.PLAYWRIGHT_BASE_URL) ??
    (env.CI ? PREVIEW_BASE_URL : DEFAULT_LOCAL_BASE_URL)
  );
}

export function resolvePlaywrightApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const baseUrl = resolvePlaywrightBaseUrl(env);
  if (isWorkspacePreviewTarget(baseUrl)) {
    return new URL(baseUrl).origin;
  }

  return readTrimmedEnvValue(env.PLAYWRIGHT_API_BASE_URL);
}

export function isRemotePlaywrightTarget(
  baseUrl = resolvePlaywrightBaseUrl()
): boolean {
  return /^https:\/\//i.test(baseUrl);
}

function isLocalPlaywrightHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.") ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function isLocalHttpsPlaywrightTarget(baseUrl: string): boolean {
  if (!isRemotePlaywrightTarget(baseUrl)) {
    return false;
  }

  try {
    return isLocalPlaywrightHost(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

export function isWorkspacePreviewTarget(
  baseUrl = resolvePlaywrightBaseUrl()
): boolean {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" || url.port || url.username || url.password) {
      return false;
    }
    const preview = parsePreviewHostname(url.hostname);
    return (
      preview !== null && (preview.repo === null || preview.repo === "frontend")
    );
  } catch {
    return false;
  }
}

export function resolvePlaywrightAppSurface(
  env: NodeJS.ProcessEnv = process.env
): AppSurface {
  const configuredSurface = readTrimmedEnvValue(env.PLAYWRIGHT_APP_SURFACE);

  if (configuredSurface) {
    return resolveAppSurface(configuredSurface, false);
  }

  const baseUrl = resolvePlaywrightBaseUrl(env);

  if (
    isRemotePlaywrightTarget(baseUrl) &&
    !isLocalHttpsPlaywrightTarget(baseUrl)
  ) {
    return "web";
  }

  return "android-native";
}
