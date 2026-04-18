// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);

const trackedFiles = [
  "src/hooks/useAuth.test.ts",
  "src/components/ProtectedRoute.test.tsx",
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
