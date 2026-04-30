// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError, type ApiValidationErrors } from "./ApiError";
import type { OrganizationalScope } from "../types/organizationalScope";

export interface OrganizationalScopeFormData {
  user_id: string;
  organizational_unit_id: string;
  access_level: "none" | "read" | "write" | "manage";
  include_descendants?: boolean;
  // Leadership-based access control fields (ADR-009)
  min_viewable_rank?: number | null;
  max_viewable_rank?: number | null;
  min_assignable_rank?: number | null;
  max_assignable_rank?: number | null;
  allow_self_access?: boolean;
}

async function buildScopeApiError(
  response: Response,
  fallbackMessage: string
): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;

  return new ApiError(
    typeof error?.message === "string" && error.message.length > 0
      ? error.message
      : fallbackMessage,
    response.status,
    typeof error?.errors === "object" && error.errors !== null
      ? (error.errors as ApiValidationErrors)
      : undefined,
    response
  );
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
    throw await buildScopeApiError(
      response,
      "Failed to fetch organizational scopes"
    );
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
    throw await buildScopeApiError(
      response,
      "Failed to create organizational scope"
    );
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
    throw await buildScopeApiError(
      response,
      "Failed to update organizational scope"
    );
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
    throw await buildScopeApiError(
      response,
      "Failed to delete organizational scope"
    );
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
    throw await buildScopeApiError(
      response,
      "Failed to fetch my organizational scopes"
    );
  }

  return await response.json();
}
