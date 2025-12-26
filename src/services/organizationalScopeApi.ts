// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import type { OrganizationalScope } from "../types/organizationalScope";

export interface OrganizationalScopeFormData {
  user_id: string;
  organizational_unit_id: string;
  access_level: "none" | "read" | "write" | "manage" | "admin";
  include_descendants?: boolean;
  // Leadership-based access control fields (ADR-009)
  min_viewable_rank?: number | null;
  max_viewable_rank?: number | null;
  min_assignable_rank?: number | null;
  max_assignable_rank?: number | null;
  allow_self_access?: boolean;
}

/**
 * Fetch all scope assignments for an organizational unit
 */
export async function listOrganizationalScopes(
  organizationalUnitId: string
): Promise<{ data: OrganizationalScope[] }> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/api/v1/organizational-units/${organizationalUnitId}/scopes`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch organizational scopes");
  }

  return await response.json();
}

/**
 * Create a new scope assignment
 */
export async function createOrganizationalScope(
  organizationalUnitId: string,
  data: OrganizationalScopeFormData
): Promise<{ data: OrganizationalScope }> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/api/v1/organizational-units/${organizationalUnitId}/scopes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to create organizational scope");
  }

  return await response.json();
}

/**
 * Update an existing scope assignment
 */
export async function updateOrganizationalScope(
  organizationalUnitId: string,
  scopeId: string,
  data: Partial<OrganizationalScopeFormData>
): Promise<{ data: OrganizationalScope }> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/api/v1/organizational-units/${organizationalUnitId}/scopes/${scopeId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update organizational scope");
  }

  return await response.json();
}

/**
 * Delete a scope assignment
 */
export async function deleteOrganizationalScope(
  organizationalUnitId: string,
  scopeId: string
): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/api/v1/organizational-units/${organizationalUnitId}/scopes/${scopeId}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to delete organizational scope");
  }
}

/**
 * Get the current user's organizational scopes
 */
export async function getMyOrganizationalScopes(): Promise<{
  data: OrganizationalScope[];
}> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/api/v1/me/organizational-scopes`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch my organizational scopes");
  }

  return await response.json();
}
