// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
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

describe("shadcn source provenance", () => {
  it("keeps SecPal source licensing separate from centrally recorded MIT provenance", () => {
    for (const sourcePath of shadcnDerivedSources) {
      const source = readFileSync(path.join(repoRoot, sourcePath), "utf8");

      expect(source, sourcePath).toContain(
        "SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution"
      );
      expect(source, sourcePath).not.toContain(
        "SPDX-FileCopyrightText: 2023 shadcn"
      );
      expect(source, sourcePath).not.toContain(
        "MIT AND AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution"
      );
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

    for (const scriptName of [
      "build",
      "build:web",
      "build:android",
      "build:android:mock",
      "build:ios",
      "build:analyze",
    ]) {
      expect(packageJson.scripts[scriptName], scriptName).toContain(
        "npm run generate:dependency-sbom"
      );
    }
  });
});
