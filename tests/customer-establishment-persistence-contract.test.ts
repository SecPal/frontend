// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { cwd } from "node:process";
import { beforeAll, describe, expect, it } from "vitest";

const contractPath = path.join(
  cwd(),
  "docs",
  "customer-establishment-persistence.md"
);

let contract: string;
let normalizedContract: string;

beforeAll(() => {
  contract = readFileSync(contractPath, "utf8");
  normalizedContract = contract.replace(/\s+/g, " ");
});

describe("Customer-Establishment persistence contract", () => {
  it("defines the tenant-safe relationship table and unique pair", () => {
    expect(contract).toContain("`customer_establishments`");
    expect(normalizedContract).toContain(
      "`id`, `tenant_id`, `customer_id`, `establishment_id`, `contact`, `notes`, `created_at`, and `updated_at`"
    );
    expect(contract).toContain("UNIQUE (customer_id, establishment_id)");
    expect(contract).toContain(
      "FOREIGN KEY (tenant_id, customer_id) REFERENCES customers (tenant_id, id)"
    );
    expect(contract).toContain(
      "FOREIGN KEY (tenant_id, establishment_id) REFERENCES organizational_units (tenant_id, id)"
    );
  });

  it("makes the customer own relationship data instead of global contact fields", () => {
    expect(contract).toContain("Customer::establishmentRelationships");
    expect(contract).toContain("CustomerEstablishment::customer");
    expect(contract).toContain("CustomerEstablishment::establishment");
    expect(normalizedContract).toContain(
      "`customers.contact` and `customers.notes` are dropped"
    );
    expect(contract).toMatch(/not writable or readable as Customer attributes/);
  });

  it("migrates sites only to proven establishments under the customer's Legal Entity", () => {
    expect(contract).toContain("sites.establishment_id");
    expect(contract).toContain("idx_sites_tenant_establishment");
    expect(contract).toContain("sites_tenant_establishment_fk");
    expect(contract).toContain("organizational_unit_closures");
    expect(contract).toMatch(
      /ancestor_id = customers\.legal_entity_id[\s\S]*descendant_id = sites\.organizational_unit_id/
    );
    expect(contract).toMatch(/organizational_units\.is_establishment = true/);
  });

  it("fails closed before mutation when any legacy row is ambiguous", () => {
    expect(contract).toContain("preflight transaction");
    expect(contract).toContain("zero writes");
    expect(contract).toContain("audited migration exception queue");
    expect(contract).toContain("RuntimeException");
    expect(contract).toMatch(/No first, only, or default Establishment/);
    expect(normalizedContract).toContain(
      "relationship-specific contact and notes start empty"
    );
  });

  it("requires migration and model tests for constraints and failure paths", () => {
    expect(contract).toContain("Required API Tests");
    expect(contract).toContain("duplicate `(customer_id, establishment_id)`");
    expect(contract).toContain("cross-tenant customer relationship");
    expect(contract).toContain("cross-tenant Establishment relationship");
    expect(contract).toContain("ambiguous legacy customer data");
    expect(contract).toContain("invalid legacy site hierarchy");
  });
});
