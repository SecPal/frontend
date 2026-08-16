// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

describe("Issue 1559 Polyscope preview staging regression", () => {
  it("ignores transient preview assets without ignoring tracked JavaScript", async () => {
    const eslint = new ESLint({ cwd: repoRoot });
    const previewAsset = path.join(
      repoRoot,
      ".polyscope-preview-stage",
      "workspace",
      "assets",
      "ActivityLogList-DZcvh31E.js"
    );
    const trackedJavaScriptFile = path.join(
      repoRoot,
      "public",
      "runtime-config.js"
    );

    await expect(eslint.isPathIgnored(previewAsset)).resolves.toBe(true);
    await expect(eslint.isPathIgnored(trackedJavaScriptFile)).resolves.toBe(
      false
    );
  });
});
