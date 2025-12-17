// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Type definitions for INTERNAL organizational structure (company branches, divisions, departments).
 *
 * NOTE: This file contains ONLY internal OrganizationalUnit types.
 * For EXTERNAL customer management (Customer & Site), see customers.ts (Epic #210).
 *
 * Based on ADR-007: Organizational Structure Hierarchy
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251126-organizational-structure-hierarchy.md
 */

/**
 * Organizational unit types for internal company structure
 */
export type OrganizationalUnitType =
  | "holding"
  | "company"
  | "region"
  | "branch"
  | "division"
  | "department"
  | "custom";

/**
 * Organizational unit representing internal company structure
 * (e.g., our branches, divisions, departments)
 */
export interface OrganizationalUnit {
  id: string;
  type: OrganizationalUnitType;
  name: string;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  parent?: OrganizationalUnit | null;
  children?: OrganizationalUnit[];
  ancestors?: OrganizationalUnit[];
  descendants?: OrganizationalUnit[];
  created_at: string;
  updated_at: string;
}

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
export interface OrganizationalUnitPaginationMeta extends PaginationMeta {
  /**
   * IDs of units that should be displayed as tree roots.
   * These are the user's highest accessible units (units without accessible parents).
   * Used to build permission-filtered tree views.
   */
  root_unit_ids: string[];
}

/**
 * Paginated response specifically for organizational units
 */
export interface OrganizationalUnitPaginatedResponse {
  data: OrganizationalUnit[];
  meta: OrganizationalUnitPaginationMeta;
}

/**
 * Create organizational unit request
 */
export interface CreateOrganizationalUnitRequest {
  name: string;
  type: OrganizationalUnitType;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  parent_id?: string | null;
}

/**
 * Update organizational unit request
 */
export interface UpdateOrganizationalUnitRequest {
  name?: string;
  type?: OrganizationalUnitType;
  custom_type_name?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Filter parameters for listing organizational units
 */
export interface OrganizationalUnitFilters {
  type?: OrganizationalUnitType;
  parent_id?: string | null;
  per_page?: number;
  page?: number;
}
