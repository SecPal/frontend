// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

function collectTrackedFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      return collectTrackedFiles(relativePath);
    }

    if (!/\.(test|spec)\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [relativePath];
  });
}

const trackedFiles = [
  ...collectTrackedFiles("src"),
  ...collectTrackedFiles("tests"),
];

const directAuthUserWritePattern =
  /(?:(?:window|globalThis)\s*\.\s*)?localStorage\s*\.\s*setItem\(\s*["']auth_user["']\s*,\s*JSON\s*\.\s*stringify\(/;

describe("Issue 889 auth storage fixture regression", () => {
  it("does not seed auth_user test state via direct localStorage JSON writes", () => {
    const offendingFiles = trackedFiles.filter((relativePath) => {
      const fileContents = readFileSync(
        path.join(repoRoot, relativePath),
        "utf8"
      );

      return directAuthUserWritePattern.test(fileContents);
    });

    expect(offendingFiles).toEqual([]);
  });
});
