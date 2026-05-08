// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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

describe("Dependabot configuration", () => {
  const configPath = join(process.cwd(), ".github", "dependabot.yml");
  const configText = readFileSync(configPath, "utf8");
  const packageJsonPath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  const reactRuntimeGroup = getIndentedSection(configText, "react-runtime");

  it("keeps the Dependabot config in the repository", () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it("groups coupled React minor and patch updates into one pull request", () => {
    expect(reactRuntimeGroup).toContain("react-runtime:");
    expect(reactRuntimeGroup).toContain('- "react"');
    expect(reactRuntimeGroup).toContain('- "react-dom"');
    expect(reactRuntimeGroup).toContain('- "@types/react"');
    expect(reactRuntimeGroup).toContain('- "@types/react-dom"');
    expect(reactRuntimeGroup).toContain('- "minor"');
    expect(reactRuntimeGroup).toContain('- "patch"');
  });

  it("groups non-breaking GitHub Actions updates to reduce Dependabot PR noise", () => {
    expect(configText).toContain('package-ecosystem: "github-actions"');
    expect(configText).toContain("minor-and-patch:");
  });

  it("keeps top-level react runtime versions aligned", () => {
    expect(packageJson.dependencies?.react).toBe(
      packageJson.dependencies?.["react-dom"]
    );
  });
});
