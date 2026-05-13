// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export const WORKSPACE_PREVIEW_HOSTNAME_PATTERN =
  /^(?:(api|frontend|secpal-app|changelog)-)?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\.preview\.secpal\.dev$/i;

export type PreviewHostname = {
  repo: string | null;
  workspace: string;
};

export function parsePreviewHostname(
  hostname: string | null
): PreviewHostname | null {
  if (!hostname) {
    return null;
  }

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
