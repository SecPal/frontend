// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import type {
  CreateCustomerRequest,
  CreateCustomerEstablishmentRelationshipRequest,
  CreateSiteRequest,
  Customer,
  CustomerEstablishmentLookup,
  CustomerEstablishmentRelationship,
  Site,
  SiteFilters,
  UpdateCustomerEstablishmentRelationshipRequest,
  UpdateCustomerRequest,
  UpdateSiteRequest,
} from "./customers";

describe("generated customer API types", () => {
  it("syncs required legal entity ids onto customer reads and creates", () => {
    const customerLegalEntityId: Customer["legal_entity_id"] =
      "550e8400-e29b-41d4-a716-446655440001";
    const createLegalEntityId: CreateCustomerRequest["legal_entity_id"] =
      customerLegalEntityId;

    expect(createLegalEntityId).toBe(customerLegalEntityId);
  });

  it("allows legal entity reassignment in customer updates", () => {
    const update: UpdateCustomerRequest = {
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440002",
    };

    expect(update.legal_entity_id).toBe("550e8400-e29b-41d4-a716-446655440002");
  });

  it("derives establishment relationships and minimal lookups from the contract", () => {
    const establishment: CustomerEstablishmentLookup = {
      id: "550e8400-e29b-41d4-a716-446655440010",
      name: "Berlin Establishment",
    };
    const relationship: CustomerEstablishmentRelationship = {
      id: "550e8400-e29b-41d4-a716-446655440020",
      customer_id: "550e8400-e29b-41d4-a716-446655440030",
      establishment_id: establishment.id,
      establishment,
      contact: null,
      notes: null,
      created_at: "2026-07-16T10:00:00Z",
      updated_at: "2026-07-16T10:00:00Z",
    };
    const create: CreateCustomerEstablishmentRelationshipRequest = {
      establishment_id: establishment.id,
      notes: "Gatehouse",
    };
    const update: UpdateCustomerEstablishmentRelationshipRequest = {
      contact: null,
    };

    expect(relationship.establishment).toEqual(establishment);
    expect(create.establishment_id).toBe(establishment.id);
    expect(update.contact).toBeNull();
  });

  it("uses establishment ids throughout site reads, writes, and filters", () => {
    const address = {
      street: "Main Street 1",
      city: "Berlin",
      postal_code: "10115",
      country: "DE",
    };
    const site: Site = {
      id: "550e8400-e29b-41d4-a716-446655440040",
      customer_id: "550e8400-e29b-41d4-a716-446655440030",
      establishment_id: "550e8400-e29b-41d4-a716-446655440010",
      site_number: "OBJ-2026-0001",
      name: "Main Site",
      type: "permanent",
      address,
      is_active: true,
      created_at: "2026-07-16T10:00:00Z",
      updated_at: "2026-07-16T10:00:00Z",
    };
    const create: CreateSiteRequest = {
      customer_id: site.customer_id,
      establishment_id: site.establishment_id,
      name: site.name,
      type: site.type,
      address,
    };
    const update: UpdateSiteRequest = {
      establishment_id: site.establishment_id,
    };
    const filters: SiteFilters = {
      establishment_id: site.establishment_id,
    };

    expect(create.establishment_id).toBe(site.establishment_id);
    expect(update.establishment_id).toBe(site.establishment_id);
    expect(filters.establishment_id).toBe(site.establishment_id);
  });
});
