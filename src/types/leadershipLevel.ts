// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Leadership Level Type Definitions
 *
 * Based on ADR-009: Leadership-Based Access Control
 * @see https://github.com/SecPal/.github/blob/main/docs/adr/20251221-inheritance-blocking-and-leadership-access-control.md
 * @see Issue #426: PR-4 Leadership Levels Frontend UI
 * @see Issue #424: PR-2 Leadership Levels Backend API
 */

/**
 * Leadership Level representing hierarchical access control
 */
export interface LeadershipLevel {
  id: string;
  tenant_id: number;
  rank: number; // 1 = CEO (highest), ascending for lower levels
  name: string;
  description?: string | null;
  color?: string | null; // Hex color for UI badges
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  employees_count?: number; // Computed: number of employees with this level
}

/**
 * Leadership Level form data for create/update
 */
export interface LeadershipLevelFormData {
  rank: number;
  name: string;
  description?: string | null;
  color?: string | null;
  is_active: boolean;
}

/**
 * Paginated leadership level response
 */
export interface LeadershipLevelListResponse {
  data: LeadershipLevel[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/**
 * Organizational scope with leadership level filters
 * (extends UserOrganizationalScope from organizational.ts)
 */
export interface OrganizationalScopeWithLeadershipFilters {
  id: string;
  user_id: string;
  organizational_unit_id: string;
  organizational_unit: {
    id: string;
    name: string;
    type: string;
  };
  include_descendants: boolean;
  // Leadership level filters for viewing employees
  min_viewable_rank?: number | null;
  max_viewable_rank?: number | null;
  // Leadership level filters for assigning/removing leadership
  min_assignable_rank?: number | null;
  max_assignable_rank?: number | null;
  // Self-access control (conditional: only if user's rank in viewable range)
  allow_self_access?: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Scope assignment form data for 2-step UI
 */
export interface ScopeAssignmentFormData {
  organizational_unit_id: string;
  include_descendants: boolean;
  // Step 1: Viewing permissions
  min_viewable_rank?: number | null;
  max_viewable_rank?: number | null;
  // Step 2: Assignment permissions
  min_assignable_rank?: number | null;
  max_assignable_rank?: number | null;
  // Step 3 (conditional): Self-access control
  allow_self_access?: boolean;
}

/**
 * Validation result for rank range combinations
 */
export interface RankRangeValidation {
  valid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Preset rank range configurations
 */
export interface RankRangePreset {
  label: string;
  min: number | null;
  max: number | null;
}
