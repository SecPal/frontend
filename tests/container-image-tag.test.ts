// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const imageTagScript = path.join(
  repoRoot,
  "scripts/container-test-image-tag.mjs"
);

function imageTagFor(workspaceRoot: string): string {
  return execFileSync(process.execPath, [imageTagScript, workspaceRoot], {
    encoding: "utf8",
  }).trim();
}

describe("frontend container test image tag", () => {
  it("is stable within one workspace and isolated between workspaces", () => {
    const firstWorkspaceTag = imageTagFor("/workspace/frontend-a");

    expect(imageTagFor("/workspace/frontend-a")).toBe(firstWorkspaceTag);
    expect(imageTagFor("/workspace/frontend-b")).not.toBe(firstWorkspaceTag);
    expect(firstWorkspaceTag).toMatch(
      /^secpal-frontend:contract-test-[a-f0-9]{12}$/u
    );
  });
});
