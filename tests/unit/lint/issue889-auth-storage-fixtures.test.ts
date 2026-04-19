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

const TEST_FILE_PATTERN = /\.(test|spec)\.tsx?$/;

function collectTrackedFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      return collectTrackedFiles(relativePath);
    }

    if (!TEST_FILE_PATTERN.test(entry.name)) {
      return [];
    }

    return [relativePath];
  });
}

const trackedFiles = [
  ...collectTrackedFiles("src"),
  ...collectTrackedFiles("tests"),
];

// Matches direct writes to the auth_user localStorage key using JSON.stringify
// as the value argument, with optional window./globalThis. prefix and flexible
// whitespace around delimiters; either quote style is accepted for the key.
const storageObjectPrefixPattern = String.raw`(?:(?:window|globalThis)\s*\.\s*)?`;
const localStorageSetItemPattern = String.raw`localStorage\s*\.\s*setItem\(`;
const authUserKeyPattern = String.raw`\s*["']auth_user["']\s*,`;
const jsonStringifyPattern = String.raw`\s*JSON\s*\.\s*stringify\(`;

const directAuthUserWritePattern = new RegExp(
  `${storageObjectPrefixPattern}${localStorageSetItemPattern}${authUserKeyPattern}${jsonStringifyPattern}`
);

describe("Issue 889 auth storage fixture regression", () => {
  it("does not seed auth_user test state via direct localStorage JSON writes (performance note: this test synchronously scans all tracked src/tests files and may slow as the repository grows)", () => {
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
