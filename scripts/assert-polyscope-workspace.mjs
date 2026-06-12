#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

// Workspace-preview preflight for live-only npm scripts. Fails fast (exit 1)
// when no Polyscope workspace can be resolved, preventing Playwright from
// silently exiting 0 because every live test self-skipped.
//
// Usage:
//   node scripts/assert-polyscope-workspace.mjs "<script-name>"

import { hasResolvableWorkspacePreviewTarget } from "./polyscope-workspace.mjs";

const scriptName = process.argv[2]?.trim() ?? "this live script";

if (!hasResolvableWorkspacePreviewTarget()) {
  console.error(
    `${scriptName} must run inside a Polyscope workspace clone (under ~/.polyscope/clones/<id>/<workspace>) or with POLYSCOPE_WORKSPACE set, or with PLAYWRIGHT_BASE_URL pointing at a workspace-preview frontend URL (https://frontend-<workspace>.preview.secpal.dev or https://<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface.`
  );
  process.exit(1);
}

process.exit(0);
