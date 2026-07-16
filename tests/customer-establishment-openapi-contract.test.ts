// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type OpenApiSchema = {
  additionalProperties?: boolean;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  type?: string;
};

type OpenApiOperation = {
  description?: string;
  security?: Array<Record<string, unknown>>;
};

type CustomerEstablishmentContract = {
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const contractPath = resolve(process.cwd(), "docs/openapi.yaml");
const contractSource = readFileSync(contractPath, "utf8");
const contract = load(contractSource) as CustomerEstablishmentContract;
const schemas = contract.components.schemas;

describe("customer-establishment OpenAPI contract", () => {
  it("keeps customer master data separate from visible relationships", () => {
    const customer = schemas.Customer;

    expect(customer?.required).toContain("establishment_relationships");
    expect(customer?.properties).toHaveProperty("establishment_relationships");
    expect(customer?.properties).not.toHaveProperty("contact");
    expect(customer?.properties).not.toHaveProperty("notes");
  });

  it("defines minimal establishment lookup and relationship schemas", () => {
    const lookup = schemas.CustomerEstablishmentLookup;

    expect(lookup?.additionalProperties).toBe(false);
    expect(lookup?.required).toEqual(["id", "name"]);
    expect(Object.keys(lookup?.properties ?? {})).toEqual(["id", "name"]);
    expect(schemas).toHaveProperty("CustomerEstablishmentRelationship");
    expect(schemas).toHaveProperty(
      "CustomerEstablishmentRelationshipCreateRequest"
    );
    expect(schemas).toHaveProperty(
      "CustomerEstablishmentRelationshipUpdateRequest"
    );
    expect(
      schemas.CustomerEstablishmentRelationshipCreateRequest?.required
    ).toContain("establishment_id");
  });

  it("requires the initial legal entity and establishment relationship", () => {
    const createRequest = schemas.CustomerCreateRequest;

    expect(createRequest?.required).toEqual(
      expect.arrayContaining([
        "legal_entity_id",
        "establishment_id",
        "name",
        "billing_address",
      ])
    );
    expect(createRequest?.properties).toHaveProperty("contact");
    expect(createRequest?.properties).toHaveProperty("notes");
  });

  it("protects lookup and relationship routes without disclosing hidden establishments", () => {
    const protectedPaths = {
      "/customers/establishments": ["get"],
      "/customers/{customer}/establishments": ["get", "post"],
      "/customers/{customer}/establishments/{relationship}": [
        "patch",
        "delete",
      ],
    };

    for (const [path, methods] of Object.entries(protectedPaths)) {
      expect(Object.keys(contract.paths[path] ?? {})).toEqual(methods);

      for (const method of methods) {
        const operation = contract.paths[path]?.[method];

        expect(operation).toBeDefined();
        expect(operation.security).toEqual([{ BearerAuth: [] }]);
        expect(operation.description).toMatch(/not disclose|non-disclosure/i);
      }
    }
  });

  it("binds sites to establishments and retires generic organization units", () => {
    for (const schemaName of [
      "Site",
      "SiteCreateRequest",
      "SiteUpdateRequest",
    ]) {
      const properties = schemas[schemaName]?.properties;

      expect(properties).toHaveProperty("establishment_id");
      expect(properties).not.toHaveProperty("organizational_unit_id");
    }
    expect(schemas.Site?.required).toContain("establishment_id");
    expect(schemas.SiteCreateRequest?.required).toContain("establishment_id");

    expect(contractSource).not.toContain("organizational_unit_id");
  });
});
