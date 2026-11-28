// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const textGuidanceFilePattern =
  /\.(?:cjs|css|html|js|json|jsx|md|mjs|scss|sh|ts|tsx|txt|ya?ml)$/;

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

function listActiveGuidanceFiles(): string[] {
  return listTrackedFiles().filter(
    (file) =>
      textGuidanceFilePattern.test(file) &&
      file !== "package-lock.json" &&
      file !== "tests/native-api-development-guidance.test.ts"
  );
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

  it("points to the owned local API and browser-session guidance", () => {
    expect(readRepoFile("README.md")).toContain(
      "https://github.com/SecPal/api/blob/main/README.md#quick-start"
    );
    expect(readRepoFile("docs/development/TDD_WORKFLOW.md")).toContain(
      "- **Pest** (backend testing, in the SecPal/api checkout): `php artisan test`"
    );
    const securityPolicy = readRepoFile("SECURITY.md");
    expect(securityPolicy).toContain(
      "https://github.com/SecPal/api/blob/main/docs/guides/sanctum-spa-auth.md"
    );
    expect(securityPolicy).toContain(
      "https://github.com/SecPal/contracts/blob/main/docs/openapi.yaml"
    );
  });

  it("scans only text-based active guidance files", () => {
    const activeGuidanceFiles = listActiveGuidanceFiles();

    expect(activeGuidanceFiles).not.toContain("package-lock.json");
    expect(activeGuidanceFiles).not.toContain("public/logo-source.png");
  });

  it("keeps active frontend guidance free of retired local-environment references", () => {
    const retiredEnvironmentPattern = new RegExp(
      ["\\bD", "DEV\\b|\\bd", "dev\\b|\\.d", "dev"].join("")
    );
    const retiredEnvironmentReferences = listActiveGuidanceFiles()
      .filter((file) => file !== "CHANGELOG.md")
      .flatMap((file) =>
        readRepoFile(file)
          .split("\n")
          .map((line, index) => ({ file, line, lineNumber: index + 1 }))
      )
      .filter(({ line }) => retiredEnvironmentPattern.test(line));

    expect(retiredEnvironmentReferences).toEqual([]);
  });
});
