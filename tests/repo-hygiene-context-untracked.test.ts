// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

function listTrackedFilesUnderContext(): string[] {
  // Use `git ls-files -- .context` (pathspec form) so the command returns an
  // empty list — instead of the usual "fatal: pathspec did not match" — when
  // `.context/` does not exist on disk. Tracking status is what we assert on,
  // so a missing directory must still be a passing case.
  const result = spawnSync("git", ["ls-files", "--", ".context"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  expect(result.error, `git ls-files failed to spawn: ${result.error}`).toBe(
    undefined
  );
  expect(
    result.status,
    `git ls-files exited with ${result.status}: ${result.stderr}`
  ).toBe(0);

  return result.stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

describe("repo hygiene: .context/ stays out of the tracked tree", () => {
  it("does not track any file under .context/", () => {
    // `.gitignore` lists `.context` as ignored, but `.gitignore` does not apply
    // to paths that were already added to the index. This guard catches the
    // regression in #1200 where `.context/progress.md` was carried into
    // `origin/main` and kept showing up in every shadcn-migration commit even
    // though the directory is documented as a workspace-local agent
    // collaboration area.
    expect(listTrackedFilesUnderContext()).toEqual([]);
  });
});
