// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  parsePreviewHostname,
  type PreviewHostname,
} from "../../src/previewHostname";

const POLYSCOPE_CLONE_PATH_PATTERN =
  /(?:^|\/)\.polyscope\/clones\/[^/]+\/([^/]+)(?:\/|$)/;
const LIVE_FRONTEND_ORIGIN = "https://app.secpal.dev";
const LIVE_API_ORIGIN = "https://api.secpal.dev";
const DEFAULT_LOCAL_BASE_URL = "http://localhost:5173";

export const PREVIEW_BASE_URL = "http://localhost:4173";

function readTrimmedEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeCwd(cwd: string): string {
  return cwd.replace(/\\/g, "/");
}

function getUrlOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getPreviewHostnameFromBaseUrl(
  baseUrl: string
): PreviewHostname | undefined {
  const origin = getUrlOrigin(baseUrl);

  if (!origin) {
    return undefined;
  }

  return parsePreviewHostname(new URL(origin).hostname) ?? undefined;
}

export function buildWorkspacePreviewBaseUrl(workspace: string): string {
  return `https://frontend-${workspace}.preview.secpal.dev`;
}

export function buildWorkspacePreviewApiBaseUrl(workspace: string): string {
  return `https://api-${workspace}.preview.secpal.dev`;
}

export function detectPolyscopeWorkspaceName(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): string | undefined {
  const configuredWorkspace = readTrimmedEnvValue(env.POLYSCOPE_WORKSPACE);

  if (configuredWorkspace) {
    return configuredWorkspace;
  }

  const workspaceMatch = normalizeCwd(cwd).match(POLYSCOPE_CLONE_PATH_PATTERN);

  return workspaceMatch?.[1];
}

export function getWorkspacePreviewNameFromBaseUrl(
  baseUrl: string
): string | undefined {
  const previewHostname = getPreviewHostnameFromBaseUrl(baseUrl);

  if (
    !previewHostname ||
    (previewHostname.repo !== null && previewHostname.repo !== "frontend")
  ) {
    return undefined;
  }

  return previewHostname.workspace;
}

export function resolvePlaywrightBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): string {
  const workspace = detectPolyscopeWorkspaceName(env, cwd);

  if (workspace) {
    return buildWorkspacePreviewBaseUrl(workspace);
  }

  const configuredBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_BASE_URL);

  if (configuredBaseUrl) {
    const configuredPreviewHostname =
      getPreviewHostnameFromBaseUrl(configuredBaseUrl);

    if (
      configuredPreviewHostname &&
      (configuredPreviewHostname.repo === null ||
        configuredPreviewHostname.repo === "frontend")
    ) {
      return buildWorkspacePreviewBaseUrl(configuredPreviewHostname.workspace);
    }

    return configuredBaseUrl;
  }

  return env.CI ? PREVIEW_BASE_URL : DEFAULT_LOCAL_BASE_URL;
}

export function resolvePlaywrightApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): string | undefined {
  const workspace = detectPolyscopeWorkspaceName(env, cwd);

  if (workspace) {
    return buildWorkspacePreviewApiBaseUrl(workspace);
  }

  const configuredApiBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_API_BASE_URL);

  if (configuredApiBaseUrl) {
    const configuredApiPreviewHostname =
      getPreviewHostnameFromBaseUrl(configuredApiBaseUrl);

    if (
      configuredApiPreviewHostname &&
      (configuredApiPreviewHostname.repo === null ||
        configuredApiPreviewHostname.repo === "api")
    ) {
      return buildWorkspacePreviewApiBaseUrl(
        configuredApiPreviewHostname.workspace
      );
    }

    return configuredApiBaseUrl;
  }

  const configuredBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_BASE_URL);
  const configuredBasePreviewHostname = configuredBaseUrl
    ? getPreviewHostnameFromBaseUrl(configuredBaseUrl)
    : undefined;

  if (
    configuredBasePreviewHostname &&
    (configuredBasePreviewHostname.repo === null ||
      configuredBasePreviewHostname.repo === "frontend")
  ) {
    return buildWorkspacePreviewApiBaseUrl(
      configuredBasePreviewHostname.workspace
    );
  }

  if (
    configuredBaseUrl &&
    getUrlOrigin(configuredBaseUrl) === LIVE_FRONTEND_ORIGIN
  ) {
    return LIVE_API_ORIGIN;
  }
  return undefined;
}

export function isRemotePlaywrightTarget(
  baseUrl = resolvePlaywrightBaseUrl()
): boolean {
  return /^https:\/\//i.test(baseUrl);
}

export function isWorkspacePreviewTarget(
  baseUrl = resolvePlaywrightBaseUrl()
): boolean {
  return getWorkspacePreviewNameFromBaseUrl(baseUrl) !== undefined;
}

export function isLiveRemoteTarget(
  baseUrl = resolvePlaywrightBaseUrl()
): boolean {
  return (
    isRemotePlaywrightTarget(baseUrl) && !isWorkspacePreviewTarget(baseUrl)
  );
}
