#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: MIT

import { createHash } from "node:crypto";
import path from "node:path";

const workspaceRoot = process.argv[2];

if (!workspaceRoot) {
  throw new Error("A workspace root is required.");
}

const workspaceDigest = createHash("sha256")
  .update(path.resolve(workspaceRoot))
  .digest("hex")
  .slice(0, 12);

process.stdout.write(`secpal-frontend:contract-test-${workspaceDigest}`);
