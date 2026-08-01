// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function getIndentedSection(text: string, sectionName: string): string {
  const lines = text.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim() === `${sectionName}:`
  );

  if (startIndex === -1) {
    return "";
  }

  const sectionIndent = lines[startIndex].match(/^ */)?.[0].length ?? 0;
  const sectionLines = [lines[startIndex]];

  for (const line of lines.slice(startIndex + 1)) {
    const lineIndent = line.match(/^ */)?.[0].length ?? 0;

    if (line.trim() !== "" && lineIndent <= sectionIndent) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

function getPackageEcosystemSection(text: string, ecosystem: string): string {
  const lines = text.split("\n");
  const marker = `- package-ecosystem: "${ecosystem}"`;
  const startIndex = lines.findIndex((line) => line.trim() === marker);

  if (startIndex === -1) {
    return "";
  }

  const sectionIndent = lines[startIndex].match(/^ */)?.[0].length ?? 0;
  const sectionLines = [lines[startIndex]];

  for (const line of lines.slice(startIndex + 1)) {
    const lineIndent = line.match(/^ */)?.[0].length ?? 0;

    if (
      line.trim().startsWith("- package-ecosystem:") &&
      lineIndent === sectionIndent
    ) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

describe("Dependabot configuration", () => {
  const changelogPath = join(process.cwd(), "CHANGELOG.md");
  const configPath = join(process.cwd(), ".github", "dependabot.yml");
  const packageLockPath = join(process.cwd(), "package-lock.json");
  const packageJsonPath = join(process.cwd(), "package.json");

  function readConfigText(): string {
    expect(existsSync(configPath)).toBe(true);

    return readFileSync(configPath, "utf8");
  }

  function readDependencies(
    dependencyType: "dependencies" | "devDependencies" = "dependencies"
  ): Record<string, string> {
    expect(existsSync(packageJsonPath)).toBe(true);

    return (
      (
        JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        }
      )[dependencyType] ?? {}
    );
  }

  it("keeps the Dependabot config in the repository", () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it("groups coupled React minor and patch updates into one pull request", () => {
    const reactRuntimeGroup = getIndentedSection(
      readConfigText(),
      "react-runtime"
    );

    expect(reactRuntimeGroup).toContain("react-runtime:");
    expect(reactRuntimeGroup).toContain('- "react"');
    expect(reactRuntimeGroup).toContain('- "react-dom"');
    expect(reactRuntimeGroup).toContain('- "@types/react"');
    expect(reactRuntimeGroup).toContain('- "@types/react-dom"');
    expect(reactRuntimeGroup).toContain('- "minor"');
    expect(reactRuntimeGroup).toContain('- "patch"');
  });

  it("groups non-breaking GitHub Actions updates to reduce Dependabot PR noise", () => {
    const configText = readConfigText();

    expect(configText).toContain('package-ecosystem: "github-actions"');
    expect(configText).toContain("minor-and-patch:");
  });

  it("keeps top-level react runtime versions aligned", () => {
    const dependencies = readDependencies();

    expect(dependencies.react).toBeDefined();
    expect(dependencies["react-dom"]).toBeDefined();
    expect(dependencies.react).toBe(dependencies["react-dom"]);
  });

  it("tracks the Browserslist browser database as a direct development dependency", () => {
    const devDependencies = readDependencies("devDependencies");
    const caniuseLiteRange = devDependencies["caniuse-lite"];
    const npmUpdates = getPackageEcosystemSection(readConfigText(), "npm");

    expect(caniuseLiteRange).toMatch(/^\^1\.0\.\d+$/);
    expect(npmUpdates).toContain('versioning-strategy: "increase"');

    expect(existsSync(packageLockPath)).toBe(true);
    const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8")) as {
      packages?: Record<
        string,
        {
          devDependencies?: Record<string, string>;
          version?: string;
        }
      >;
    };

    expect(packageLock.packages?.[""]?.devDependencies?.["caniuse-lite"]).toBe(
      caniuseLiteRange
    );
    expect(packageLock.packages?.["node_modules/caniuse-lite"]?.version).toBe(
      caniuseLiteRange?.slice(1)
    );
  });

  it("documents Browserslist database update automation", () => {
    expect(existsSync(changelogPath)).toBe(true);

    const changelog = readFileSync(changelogPath, "utf8");

    expect(changelog).toMatch(
      /Declared `caniuse-lite` as an explicit development dependency so daily\s+Dependabot updates/
    );
  });
});
