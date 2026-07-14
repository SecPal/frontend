// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";

const decisionDocumentPath = path.join(
  cwd(),
  "docs",
  "legal-entity-customer-migration.md"
);

describe("Legal Entity customer migration decision", () => {
  it("blocks customer backfill until the business-approved rule is documented", () => {
    const decision = readFileSync(decisionDocumentPath, "utf8");

    expect(decision).toContain("Migration status: blocked");
    expect(decision).toContain("No silent default assignment");
    expect(decision).toContain("Tenant Consistency");
    expect(decision).toContain("business approval");
    expect(decision).toContain("must not assign");
  });
});
