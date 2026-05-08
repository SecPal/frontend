// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Dependabot configuration", () => {
    const configPath = join(process.cwd(), ".github", "dependabot.yml");
    const configText = readFileSync(configPath, "utf8");
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
        dependencies?: Record<string, string>;
    };

    it("keeps the Dependabot config in the repository", () => {
        expect(existsSync(configPath)).toBe(true);
    });

    it("groups coupled React minor and patch updates into one pull request", () => {
        expect(configText).toContain("react-runtime:");
        expect(configText).toContain('- "react"');
        expect(configText).toContain('- "react-dom"');
        expect(configText).toContain('- "@types/react"');
        expect(configText).toContain('- "@types/react-dom"');
        expect(configText).toContain('- "minor"');
        expect(configText).toContain('- "patch"');
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
