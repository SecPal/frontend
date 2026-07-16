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
  it("records the approved customer identity and duplicate resolution rules", () => {
    const decision = readFileSync(decisionDocumentPath, "utf8");

    expect(decision).toContain("Migration status: approved");
    expect(decision).toContain("Identity Rule per Legal Entity");
    expect(decision).toContain("normalized VAT ID");
    expect(decision).toMatch(/must\s+never be merged automatically/);
    expect(decision).toContain("Master Data Conflicts");
    expect(decision).toMatch(/field\s+by\s+field/);
  });

  it("records the relationship authorization rule", () => {
    const decision = readFileSync(decisionDocumentPath, "utf8");

    expect(decision).toContain(
      "Customer-Establishment Relationship Authorization"
    );
    expect(decision).toContain("`customers.update`");
    expect(decision).toContain("organizational write scope");
    expect(decision).toContain("deny by default");
  });

  it("records the approved handling of global and ambiguous migration data", () => {
    const decision = readFileSync(decisionDocumentPath, "utf8");

    expect(decision).toContain("Approved Migration Path");
    expect(decision).toContain("must not be copied");
    expect(decision).toContain("unassigned migration exception queue");
    expect(decision).toContain("No silent default assignment");
    expect(decision).toContain("dry run");
  });
});
