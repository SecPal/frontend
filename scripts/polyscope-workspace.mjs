// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

// Shared Polyscope workspace-preview detection for npm scripts. Mirrors the
// resolver in `tests/e2e/target-urls.ts` so npm scripts that gate on a
// Polyscope workspace fail fast when no workspace is selected. Keep this
// regex in sync with `POLYSCOPE_CLONE_PATH_PATTERN` in `target-urls.ts`.
const POLYSCOPE_CLONE_PATH_PATTERN =
  /(?:^|\/)\.polyscope\/clones\/[^/]+\/([^/]+)(?:\/|$)/;

// Mirrors `parsePreviewHostname` and `getWorkspacePreviewNameFromBaseUrl` in
// `tests/e2e/target-urls.ts`. Accept canonical preview hosts as well as
// `frontend-<workspace>` ones, but reject other repo previews such as `api-*`.
const WORKSPACE_PREVIEW_HOSTNAME_PATTERN =
  /^(?:(api|frontend|secpal-app|changelog)-)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.preview\.secpal\.dev$/i;

export function detectPolyscopeWorkspaceName(
  env = process.env,
  cwd = process.cwd()
) {
  const explicit = env.POLYSCOPE_WORKSPACE?.trim() ?? "";
  if (explicit.length > 0) {
    return explicit;
  }

  const normalizedCwd = cwd.replace(/\\/g, "/");
  const workspaceMatch = normalizedCwd.match(POLYSCOPE_CLONE_PATH_PATTERN);

  return workspaceMatch?.[1] ?? "";
}

export function getResolvableWorkspacePreviewName(baseUrl) {
  if (typeof baseUrl !== "string" || baseUrl.length === 0) {
    return "";
  }

  try {
    const previewMatch = new URL(baseUrl).hostname.match(
      WORKSPACE_PREVIEW_HOSTNAME_PATTERN
    );

    if (!previewMatch) {
      return "";
    }

    const [, repo, workspace] = previewMatch;

    if (repo && repo.toLowerCase() !== "frontend") {
      return "";
    }

    return workspace.toLowerCase();
  } catch {
    return "";
  }
}

export function hasResolvableWorkspacePreviewTarget(
  env = process.env,
  cwd = process.cwd()
) {
  if (detectPolyscopeWorkspaceName(env, cwd).length > 0) {
    return true;
  }

  const baseUrlOverride = env.PLAYWRIGHT_BASE_URL?.trim() ?? "";

  // An explicit PLAYWRIGHT_BASE_URL override is only accepted when it resolves
  // to a workspace-preview frontend target; pure live targets such as
  // app.secpal.dev are intentionally not part of the Polyscope E2E surface.
  return getResolvableWorkspacePreviewName(baseUrlOverride).length > 0;
}
