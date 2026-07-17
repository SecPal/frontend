// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { components } from "./openapi.generated";

type Schemas = components["schemas"];

export type Customer = Schemas["Customer"];
export type CreateCustomerRequest = Schemas["CustomerCreateRequest"];
export type LegalEntityLookup = Schemas["LegalEntityLookup"];
export type CustomerLegalEntityLookup = LegalEntityLookup;
export type EstablishmentLookup = Schemas["EstablishmentLookup"];
export type CustomerLookup = Pick<Customer, "id" | "name">;
export type CustomerEstablishment = Schemas["CustomerEstablishment"];
export type CreateCustomerEstablishmentRequest =
  Schemas["CustomerEstablishmentCreateRequest"];
export type UpdateCustomerEstablishmentRequest =
  Schemas["CustomerEstablishmentUpdateRequest"];
export type Address = Schemas["Address"];
export type Contact = Schemas["Contact"];
export type UpdateCustomerRequest = Schemas["CustomerUpdateRequest"];
