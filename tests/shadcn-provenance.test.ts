// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const packageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8")
) as { scripts: Record<string, string> };

const shadcnDerivedSources = [
  "src/ui/alert.tsx",
  "src/ui/avatar.tsx",
  "src/ui/breadcrumb.tsx",
  "src/ui/button.tsx",
  "src/ui/card.tsx",
  "src/ui/checkbox.tsx",
  "src/ui/collapsible.tsx",
  "src/ui/dropdown-menu.tsx",
  "src/ui/input.tsx",
  "src/ui/select.tsx",
  "src/ui/separator.tsx",
  "src/ui/sheet.tsx",
  "src/ui/sidebar.tsx",
  "src/ui/skeleton.tsx",
  "src/ui/switch.tsx",
  "src/ui/textarea.tsx",
  "src/ui/tooltip.tsx",
  "src/components/app-sidebar.tsx",
  "src/components/nav-main.tsx",
  "src/components/nav-user.tsx",
  "src/components/team-switcher.tsx",
];

const releaseBuildConfigurations = [
  { scriptName: "build", surface: "web", mode: undefined },
  { scriptName: "build:web", surface: "web", mode: "web" },
  {
    scriptName: "build:android",
    surface: "android-native",
    mode: "android",
  },
  {
    scriptName: "build:android:mock",
    surface: "android-mock",
    mode: "preview",
  },
  { scriptName: "build:ios", surface: "ios-native", mode: "ios" },
  { scriptName: "build:analyze", surface: "web", mode: "analyze" },
] as const;

describe("shadcn source provenance", () => {
  it("keeps SecPal source licensing and aggregates shadcn MIT provenance", () => {
    for (const sourcePath of shadcnDerivedSources) {
      const source = readFileSync(path.join(repoRoot, sourcePath), "utf8");

      expect(source, sourcePath).toContain(
        "SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution"
      );
    }

    const reuseConfig = readFileSync(path.join(repoRoot, "REUSE.toml"), "utf8");
    expect(reuseConfig).toContain('precedence = "aggregate"');
    expect(reuseConfig).toContain('SPDX-FileCopyrightText = "2023 shadcn"');
    expect(reuseConfig).toContain('SPDX-License-Identifier = "MIT"');

    for (const sourcePath of shadcnDerivedSources) {
      expect(reuseConfig, sourcePath).toContain(`"${sourcePath}"`);
    }
  });

  it("records the registry revisions and every adapted source path", () => {
    const notice = readFileSync(
      path.join(repoRoot, "THIRD-PARTY-NOTICES.md"),
      "utf8"
    );

    expect(notice).toContain(
      "shadcn-ui/ui@ea9d371a2dda3365a382ff361f96b55daeeab88d"
    );
    expect(notice).toContain(
      "shadcn-ui/ui@a409271270ad3a5d121e21f037c28bfaff912fc7"
    );
    expect(notice).toContain("SPDX-FileCopyrightText: 2023 shadcn");

    for (const sourcePath of shadcnDerivedSources) {
      expect(notice, sourcePath).toContain(`\`${sourcePath}\``);
    }
  });

  it("separates package dependency inventory from copied-source provenance", () => {
    const notice = readFileSync(
      path.join(repoRoot, "THIRD-PARTY-NOTICES.md"),
      "utf8"
    );

    expect(notice).toContain("## NPM dependency inventory");
    expect(notice).toContain("[package-lock.json](package-lock.json)");
    expect(notice).toContain("scripts/check-license-compatibility.sh");
    expect(notice).toContain("`tailwindcss`");
    expect(notice).toContain("`@tailwindcss/vite`");
  });

  it("emits a lockfile-only SPDX dependency inventory with every release build", () => {
    expect(packageJson.scripts["generate:dependency-sbom"]).toContain(
      "npm sbom --package-lock-only --sbom-format spdx --sbom-type application"
    );
    expect(packageJson.scripts["generate:dependency-sbom"]).toContain(
      "dist/dependencies.spdx.json"
    );

    for (const { scriptName } of releaseBuildConfigurations) {
      expect(packageJson.scripts[scriptName], scriptName).toContain(
        "npm run generate:dependency-sbom"
      );
    }

    const sbom = JSON.parse(
      execFileSync(
        "npm",
        [
          "sbom",
          "--package-lock-only",
          "--sbom-format",
          "spdx",
          "--sbom-type",
          "application",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        }
      )
    ) as { packages?: unknown[]; spdxVersion?: string };

    expect(sbom.spdxVersion).toBe("SPDX-2.3");
    expect(sbom.packages?.length).toBeGreaterThan(0);
  });

  it.each(releaseBuildConfigurations)(
    "$scriptName ships the shadcn notice and MIT license",
    ({ mode, surface }) => {
      const distRoot = mkdtempSync(path.join(tmpdir(), "secpal-provenance-"));
      const safeEnv = { ...process.env, VITE_APP_SURFACE: surface };
      delete safeEnv.NODE_V8_COVERAGE;

      try {
        const viteArguments = ["exec", "--", "vite", "build"];
        if (mode) {
          viteArguments.push("--mode", mode);
        }
        viteArguments.push("--outDir", distRoot);

        execFileSync("npm", viteArguments, {
          cwd: repoRoot,
          stdio: "pipe",
          env: safeEnv,
        });

        const noticePath = path.join(distRoot, "THIRD-PARTY-NOTICES.md");
        const licensePath = path.join(distRoot, "LICENSES", "MIT.txt");
        expect(existsSync(noticePath)).toBe(true);
        expect(existsSync(licensePath)).toBe(true);
        expect(readFileSync(noticePath, "utf8")).toContain(
          "SPDX-FileCopyrightText: 2023 shadcn"
        );
        expect(readFileSync(licensePath, "utf8")).toContain(
          "The above copyright notice and this permission notice shall be included"
        );
      } finally {
        rmSync(distRoot, { recursive: true, force: true });
      }
    }
  );
});
