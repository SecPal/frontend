// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function listTrackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
}

describe("native API development guidance", () => {
  it("documents local Vite and Playwright API routing without retired environment-specific guidance", () => {
    expect(readRepoFile("src/config.ts")).toContain(
      "Development with local Vite proxy"
    );
    expect(readRepoFile("src/config.ts")).toContain(
      "forwards /v1/* and /sanctum/* to the native Laravel server"
    );
    expect(readRepoFile("playwright.config.ts")).toContain(
      "generic dev server with proxy"
    );
  });

  it("documents native Laravel API startup and backend test commands", () => {
    expect(readRepoFile("docs/authentication-migration.md")).toContain(
      "php artisan serve"
    );
    expect(readRepoFile("docs/development/TDD_WORKFLOW.md")).toContain(
      "- **Pest** (backend testing): `php artisan test`"
    );
  });

  it("keeps active frontend guidance free of retired local-environment references", () => {
    const retiredEnvironmentPattern = new RegExp(
      ["\\bD", "DEV\\b|\\bd", "dev\\b|\\.d", "dev"].join("")
    );
    const activeDdevReferences = listTrackedFiles()
      .filter(
        (file) =>
          file !== "CHANGELOG.md" &&
          file !== "tests/native-api-development-guidance.test.ts"
      )
      .flatMap((file) =>
        readRepoFile(file)
          .split("\n")
          .map((line, index) => ({ file, line, lineNumber: index + 1 }))
      )
      .filter(({ line }) => retiredEnvironmentPattern.test(line));

    expect(activeDdevReferences).toEqual([]);
  });
});
