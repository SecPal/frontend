// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Type definitions for INTERNAL organizational structure (company branches, divisions, departments).
 *
 * NOTE: This file contains ONLY internal OrganizationalUnit types.
 * For EXTERNAL customer management (Customer & Site), see customers.ts (Epic #210).
 *
 * Based on ADR-007: Organizational Structure Hierarchy
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251126-organizational-structure-hierarchy.md
 */

import type { OrganizationalUnit } from "@/types/api";
export type {
  CreateOrganizationalUnitRequest,
  OrganizationalUnit,
  OrganizationalUnitFilters,
  OrganizationalUnitPaginatedResponse,
  OrganizationalUnitPaginationMeta,
  OrganizationalUnitType,
  UpdateOrganizationalUnitRequest,
} from "@/types/api";

/**
 * User's organizational scope for RBAC
 */
export interface UserOrganizationalScope {
  id: string;
  user_id: string;
  organizational_unit_id: string;
  organizational_unit: OrganizationalUnit;
  include_descendants: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Paginated API response
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/**
 * Extended pagination metadata for organizational units
 * Includes root_unit_ids for permission-filtered tree views
 */
