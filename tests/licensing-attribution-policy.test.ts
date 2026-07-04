// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const projectRoot = cwd();
const attributionTermsPath = path.join(
  projectRoot,
  "LICENSES",
  "LicenseRef-SecPal-Attribution.txt"
);

describe("SecPal attribution policy", () => {
  it("keeps the repository addendum aligned with the approved central wording", () => {
    const terms = readFileSync(attributionTermsPath, "utf8");

    expect(terms).toContain("Powered by SecPal");
    expect(terms).toContain("Based on SecPal");
    expect(terms).toContain("Based on SecPal – modified by [name/entity]");
    expect(terms).toContain("Powered by SecPal – A guard's best friend");
    expect(terms).toContain("Based on SecPal – A guard's best friend");

    expect(terms).not.toContain("Based on SecPal - modified by [name/entity]");
    expect(terms).not.toContain("Powered by SecPal - A guard's best friend");
    expect(terms).not.toContain("Based on SecPal - A guard's best friend");
  });
});
