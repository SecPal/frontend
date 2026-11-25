#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isWorkspacePreviewTarget } from "../tests/e2e/target-urls.ts";

if (!isWorkspacePreviewTarget()) {
  const scriptName = process.argv[2] ?? "This command";
  console.error(
    `${scriptName} requires PLAYWRIGHT_BASE_URL=https://<workspace>.preview.secpal.dev.`
  );
  process.exitCode = 1;
}
