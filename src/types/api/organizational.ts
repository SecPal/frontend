// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { components } from "./openapi.generated";

type Schemas = components["schemas"];

export type OrganizationalUnitType = Schemas["OrganizationalUnitType"];
export type OrganizationalUnit = Schemas["OrganizationalUnit"];
export type CreateOrganizationalUnitRequest =
  Schemas["OrganizationalUnitCreateRequest"];
export type UpdateOrganizationalUnitRequest =
  Schemas["OrganizationalUnitUpdateRequest"];
export type OrganizationalUnitPaginationMeta =
  Schemas["OrganizationalUnitPaginationMeta"];
export type OrganizationalUnitPaginatedResponse =
  Schemas["OrganizationalUnitCollectionResponse"];

export interface OrganizationalUnitFilters {
  type?: OrganizationalUnitType;
  parent_id?: string | null;
  is_active?: boolean;
  is_assignable?: boolean;
  per_page?: number;
  page?: number;
}
