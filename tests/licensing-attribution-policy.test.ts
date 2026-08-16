// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const projectRoot = cwd();
const obsoleteAttributionReference = "LicenseRef-SecPal-Attribution";

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("frontend licensing metadata", () => {
  it("uses plain AGPL-3.0-or-later without the obsolete attribution addendum", () => {
    expect(
      existsSync(
        path.join(
          projectRoot,
          "LICENSES",
          `${obsoleteAttributionReference}.txt`
        )
      )
    ).toBe(false);

    for (const relativePath of [
      "REUSE.toml",
      "package.json",
      "package-lock.json",
      "README.md",
      "CONTRIBUTING.md",
      ".github/workflows/publish-container.yml",
    ]) {
      expect(readProjectFile(relativePath), relativePath).not.toContain(
        obsoleteAttributionReference
      );
    }

    expect(readProjectFile("REUSE.toml")).toContain(
      'SPDX-License-Identifier = "AGPL-3.0-or-later"'
    );
    expect(JSON.parse(readProjectFile("package.json")).license).toBe(
      "AGPL-3.0-or-later"
    );
  });
});
