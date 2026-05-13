// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const WORKSPACE_PREVIEW_HOSTNAME_PATTERN =
  /^(?:(api|frontend|secpal-app|changelog)-)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.preview\.secpal\.dev$/i;
const POLYSCOPE_CLONE_PATH_PATTERN =
  /(?:^|\/)\.polyscope\/clones\/[^/]+\/([^/]+)(?:\/|$)/;
const LIVE_FRONTEND_ORIGIN = "https://app.secpal.dev";
const LIVE_API_ORIGIN = "https://api.secpal.dev";
const DEFAULT_LOCAL_BASE_URL = "http://localhost:5173";

type PreviewHostname = {
  repo: string | null;
  workspace: string;
};

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

function parsePreviewHostname(hostname: string): PreviewHostname | null {
  const previewMatch = hostname.match(WORKSPACE_PREVIEW_HOSTNAME_PATTERN);

  if (!previewMatch) {
    return null;
  }

  const [, repo, workspace] = previewMatch;

  if (!workspace) {
    return null;
  }

  return {
    repo: repo?.toLowerCase() ?? null,
    workspace,
  };
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
  const origin = getUrlOrigin(baseUrl);

  if (!origin) {
    return undefined;
  }

  const previewHostname = parsePreviewHostname(new URL(origin).hostname);

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
  const configuredBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_BASE_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const workspace = detectPolyscopeWorkspaceName(env, cwd);

  if (workspace) {
    return buildWorkspacePreviewBaseUrl(workspace);
  }

  return env.CI ? PREVIEW_BASE_URL : DEFAULT_LOCAL_BASE_URL;
}

export function resolvePlaywrightApiBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
): string | undefined {
  const configuredApiBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_API_BASE_URL);

  if (configuredApiBaseUrl) {
    return configuredApiBaseUrl;
  }

  const configuredBaseUrl = readTrimmedEnvValue(env.PLAYWRIGHT_BASE_URL);
  const workspaceFromBaseUrl = configuredBaseUrl
    ? getWorkspacePreviewNameFromBaseUrl(configuredBaseUrl)
    : undefined;

  if (workspaceFromBaseUrl) {
    return buildWorkspacePreviewApiBaseUrl(workspaceFromBaseUrl);
  }

  if (
    configuredBaseUrl &&
    getUrlOrigin(configuredBaseUrl) === LIVE_FRONTEND_ORIGIN
  ) {
    return LIVE_API_ORIGIN;
  }

  const workspace = detectPolyscopeWorkspaceName(env, cwd);

  return workspace ? buildWorkspacePreviewApiBaseUrl(workspace) : undefined;
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
