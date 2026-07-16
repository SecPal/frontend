// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type OpenApiSchema = {
  properties?: Record<string, OpenApiSchema>;
};

type OpenApiParameter = {
  in?: string;
  name?: string;
  required?: boolean;
  schema?: {
    items?: { enum?: string[] };
    type?: string;
  };
};

type OpenApiContract = {
  components: {
    schemas: Record<string, OpenApiSchema>;
  };
  paths: Record<
    string,
    Record<string, { description?: string; parameters?: OpenApiParameter[] }>
  >;
};

const serviceContract = readFileSync(
  resolve(process.cwd(), "docs/site-establishment-api-service.md"),
  "utf8"
);
const openApiSource = readFileSync(
  resolve(process.cwd(), "docs/openapi.yaml"),
  "utf8"
);
const openApi = load(openApiSource) as OpenApiContract;

describe("site-establishment API contract", () => {
  it("renames every site API surface and relation to establishment", () => {
    for (const surface of [
      "StoreSiteRequest",
      "UpdateSiteRequest",
      "IndexSiteRequest",
      "SiteController",
      "SiteResource",
      "Site model",
    ]) {
      expect(serviceContract).toContain(surface);
    }

    expect(serviceContract).toMatch(
      /establishment_id[\s\S]*establishment\(\)[\s\S]*forEstablishment/i
    );
    expect(serviceContract).toMatch(/with\(\['customer', 'establishment'/i);
    expect(serviceContract).not.toContain("organizational_unit_id");
  });

  it("derives legal entity authority from the locked customer and relationship", () => {
    expect(serviceContract).toMatch(
      /never accepts[\s\S]*legal_entity_id[\s\S]*customer\.legal_entity_id/i
    );
    expect(serviceContract).toMatch(
      /customer_establishments[\s\S]*customer_id[\s\S]*establishment_id/i
    );
    expect(serviceContract).toMatch(
      /lock[\s\S]*Customer[\s\S]*Customer-Establishment relationship[\s\S]*Establishment[\s\S]*re-check/i
    );
  });

  it("requires tenant, hierarchy, eligibility, and authorization checks on create and update", () => {
    expect(serviceContract).toMatch(
      /create and update[\s\S]*same tenant[\s\S]*descendant[\s\S]*is_establishment = true[\s\S]*is_active = true[\s\S]*is_assignable = true[\s\S]*deleted_at IS NULL/i
    );
    expect(serviceContract).toMatch(
      /sites\.create[\s\S]*sites\.update[\s\S]*customer[\s\S]*current Establishment[\s\S]*target Establishment/i
    );
    expect(serviceContract).toMatch(
      /PATCH[\s\S]*effective\s+customer_id[\s\S]*effective\s+establishment_id/i
    );
  });

  it("publishes establishment filters and includes without client legal-entity input", () => {
    const list = openApi.paths["/sites"]?.get;
    const parameters = list?.parameters ?? [];

    expect(parameters).toContainEqual(
      expect.objectContaining({
        in: "query",
        name: "establishment_id",
      })
    );
    expect(parameters).toContainEqual(
      expect.objectContaining({
        in: "query",
        name: "include",
        schema: expect.objectContaining({
          items: expect.objectContaining({
            enum: expect.arrayContaining(["establishment"]),
          }),
        }),
      })
    );

    expect(openApi.components.schemas.Site?.properties).toHaveProperty(
      "establishment"
    );
    for (const request of ["SiteCreateRequest", "SiteUpdateRequest"]) {
      expect(
        openApi.components.schemas[request]?.properties
      ).not.toHaveProperty("legal_entity_id");
    }
    expect(openApiSource).not.toContain("organizational_unit_id");
  });

  it("requires feature proofs for valid assignment and every trust boundary", () => {
    for (const scenario of [
      "valid assignment",
      "customer Legal Entity mismatch",
      "cross-tenant customer",
      "cross-tenant Establishment",
      "missing Customer-Establishment relationship",
      "non-Establishment unit",
      "deleted Establishment",
      "inactive Establishment",
      "unassignable Establishment",
      "missing sites.create",
      "missing sites.update",
      "missing customer access",
      "missing current Establishment scope",
      "missing target Establishment scope",
      "spoofed legal_entity_id",
    ]) {
      expect(serviceContract).toContain(scenario);
    }
    expect(serviceContract).toMatch(/Feature tests[\s\S]*authenticated HTTP/i);
  });
});
