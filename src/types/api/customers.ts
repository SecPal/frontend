// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { components } from "./openapi.generated";

type Schemas = components["schemas"];

export type Customer = Schemas["Customer"];
export type CreateCustomerRequest = Schemas["CustomerCreateRequest"];
export type CustomerLegalEntityLookup = Schemas["CustomerLegalEntityLookup"];
export type Address = Schemas["Address"];
export type Contact = Schemas["Contact"];
export type UpdateCustomerRequest = Schemas["CustomerUpdateRequest"];
