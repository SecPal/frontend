#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  detectPolyscopeWorkspaceName,
  getResolvableWorkspacePreviewName,
} from "./polyscope-workspace.mjs";

const workspaceFromCwd = detectPolyscopeWorkspaceName();
const workspaceFromBaseUrl = getResolvableWorkspacePreviewName(
  process.env.PLAYWRIGHT_BASE_URL?.trim() ?? ""
);
const workspace = workspaceFromCwd || workspaceFromBaseUrl;

if (!workspace) {
  console.error(
    "test:preview:pwa-headers must run inside a Polyscope workspace clone, or with POLYSCOPE_WORKSPACE set, or with PLAYWRIGHT_BASE_URL pointing at a workspace-preview frontend URL."
  );
  process.exit(1);
}

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-live-pwa-headers.sh"
);
const appUrl = `https://frontend-${workspace}.preview.secpal.dev`;

const result = spawnSync("bash", [scriptPath], {
  stdio: "inherit",
  env: {
    ...process.env,
    APP_URL: appUrl,
  },
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
