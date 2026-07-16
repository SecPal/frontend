// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { components } from "./openapi.generated";

type Schemas = components["schemas"];

export type Customer = Schemas["Customer"];
export type CreateCustomerRequest = Schemas["CustomerCreateRequest"];
export type CustomerLegalEntityLookup = Schemas["CustomerLegalEntityLookup"];
export type CustomerEstablishmentLookup =
  Schemas["CustomerEstablishmentLookup"];
export type CustomerEstablishmentRelationship =
  Schemas["CustomerEstablishmentRelationship"];
export type CreateCustomerEstablishmentRelationshipRequest =
  Schemas["CustomerEstablishmentRelationshipCreateRequest"];
export type UpdateCustomerEstablishmentRelationshipRequest =
  Schemas["CustomerEstablishmentRelationshipUpdateRequest"];
export type Address = Schemas["Address"];
export type Contact = Schemas["Contact"];
export type UpdateCustomerRequest = Schemas["CustomerUpdateRequest"];
export type SiteType = Schemas["SiteType"];
export type Site = Schemas["Site"];
export type CreateSiteRequest = Schemas["SiteCreateRequest"];
export type UpdateSiteRequest = Schemas["SiteUpdateRequest"];

export interface SiteFilters {
  customer_id?: string;
  establishment_id?: string;
  type?: SiteType;
  is_active?: boolean;
  currently_valid?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}
