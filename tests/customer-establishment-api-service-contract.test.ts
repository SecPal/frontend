// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

type OpenApiParameter = {
  $ref?: string;
  in?: string;
  name?: string;
  required?: boolean;
};

type OpenApiOperation = {
  description?: string;
  parameters?: OpenApiParameter[];
  responses?: Record<string, unknown>;
};

type OpenApiContract = {
  components: {
    parameters: Record<string, OpenApiParameter>;
  };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const serviceContract = readFileSync(
  resolve(process.cwd(), "docs/customer-establishment-api-service.md"),
  "utf8"
);
const openApi = load(
  readFileSync(resolve(process.cwd(), "docs/openapi.yaml"), "utf8")
) as OpenApiContract;

describe("customer-establishment API service contract", () => {
  it("limits lookup results to eligible writable establishments below the selected legal entity", () => {
    expect(serviceContract).toMatch(
      /same tenant[\s\S]*selected Legal Entity[\s\S]*is_establishment = true[\s\S]*is_active = true[\s\S]*is_assignable = true[\s\S]*deleted_at IS NULL[\s\S]*organizational write scope/i
    );

    const lookup = openApi.paths["/customers/establishments"]?.get;
    expect(lookup?.parameters).toContainEqual({
      $ref: "#/components/parameters/LegalEntityIdQuery",
    });
    expect(openApi.components.parameters.LegalEntityIdQuery).toEqual(
      expect.objectContaining({
        in: "query",
        name: "legal_entity_id",
        required: true,
      })
    );
  });

  it("locks and validates creation inputs in one transaction before applying identity", () => {
    expect(serviceContract).toMatch(
      /transaction[\s\S]*lock[^\n]*Legal Entity[\s\S]*lock[^\n]*Establishment[\s\S]*re-check/i
    );
    expect(serviceContract).toMatch(
      /normalized VAT ID[\s\S]*Legal Entity[\s\S]*customer UUID/i
    );
    expect(serviceContract).toMatch(
      /atomically[\s\S]*new Customer[\s\S]*additional relationship/i
    );
    expect(serviceContract).toMatch(
      /unique constraint[\s\S]*concurrent[\s\S]*re-read/i
    );
  });

  it("authorizes relationship creation and updates against customer, current, and target scopes", () => {
    expect(serviceContract).toMatch(
      /customers\.update[\s\S]*customer[\s\S]*Legal Entity[\s\S]*current Establishment[\s\S]*target Establishment/i
    );
    expect(serviceContract).toMatch(/deny by default/i);
  });

  it("filters relationship-owned fields from lists, details, counts, and errors", () => {
    expect(serviceContract).toMatch(
      /list and detail[\s\S]*Establishment name[\s\S]*contact[\s\S]*notes[\s\S]*visible/i
    );
    expect(serviceContract).toMatch(
      /pagination totals[\s\S]*duplicate[\s\S]*same not-found response/i
    );
  });

  it("requires feature and service coverage for every authorization and concurrency boundary", () => {
    for (const scenario of [
      "authorized multi-assignment",
      "parallel duplicate creation",
      "different tenant",
      "wrong Legal Entity",
      "deleted Establishment",
      "inactive Establishment",
      "unassignable Establishment",
      "missing organizational write scope",
      "hidden relationship fields",
      "non-disclosing duplicate response",
    ]) {
      expect(serviceContract).toContain(scenario);
    }
    expect(serviceContract).toMatch(/Feature tests[\s\S]*Service tests/i);
  });

  it("publishes deterministic duplicate and non-disclosing error responses", () => {
    const createCustomer = openApi.paths["/customers"]?.post;
    const createRelationship =
      openApi.paths["/customers/{customer}/establishments"]?.post;

    expect(createCustomer?.responses).toHaveProperty("409");
    expect(createRelationship?.responses).toHaveProperty("409");
    expect(createCustomer?.description).toMatch(/transaction|atomic|identity/i);
  });
});
