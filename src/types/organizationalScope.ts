// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * OrganizationalScope type
 *
 * Represents a user's access scope to an organizational unit,
 * including leadership-based access control fields (ADR-009).
 */
export interface OrganizationalScope {
  id: string;
  user_id: string;
  organizational_unit_id: string;
  access_level: "none" | "read" | "write" | "manage" | "admin";
  include_descendants: boolean;
  // Leadership-based access control fields (ADR-009)
  min_viewable_rank: number | null;
  max_viewable_rank: number | null;
  min_assignable_rank: number | null;
  max_assignable_rank: number | null;
  allow_self_access: boolean;
  created_at: string;
  updated_at: string;
  // Optional relations
  user?: {
    id: string;
    name: string;
    email: string;
  };
  organizational_unit?: {
    id: string;
    name: string;
    type: string;
  };
}
