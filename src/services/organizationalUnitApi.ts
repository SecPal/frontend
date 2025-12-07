// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError } from "./secretApi";
import {
  saveOrganizationalUnit as saveToCache,
  deleteOrganizationalUnit as deleteFromCache,
} from "../lib/organizationalUnitStore";
import type {
  OrganizationalUnit,
  CreateOrganizationalUnitRequest,
  UpdateOrganizationalUnitRequest,
  OrganizationalUnitFilters,
  OrganizationalUnitPaginatedResponse,
  UserOrganizationalScope,
} from "../types/organizational";

/**
 * Organizational Unit API Service
 *
 * Provides CRUD operations and hierarchy management for internal
 * organizational units (holdings, companies, regions, branches, etc.).
 *
 * The list endpoint returns permission-filtered results based on the
 * user's organizational scopes (Need-to-Know principle). The response
 * includes `root_unit_ids` for building tree views.
 *
 * @see ADR-007: Organizational Structure Hierarchy
 */

/**
 * List organizational units with optional filters
 *
 * Returns ONLY units the authenticated user has access to (Need-to-Know principle).
 * The response includes `root_unit_ids` in metadata for building permission-filtered
 * tree views where the user's highest accessible units are displayed as roots.
 */
export async function listOrganizationalUnits(
  filters?: OrganizationalUnitFilters
): Promise<OrganizationalUnitPaginatedResponse> {
  const params = new URLSearchParams();

  if (filters?.type) {
    params.set("type", filters.type);
  }
  if (filters?.parent_id !== undefined) {
    params.set("parent_id", filters.parent_id ?? "null");
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/organizational-units${queryString ? `?${queryString}` : ""}`;

  const response = await apiFetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch organizational units",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single organizational unit by ID
 */
export async function getOrganizationalUnit(
  id: string
): Promise<OrganizationalUnit> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch organizational unit",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new organizational unit
 */
export async function createOrganizationalUnit(
  data: CreateOrganizationalUnitRequest
): Promise<OrganizationalUnit> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to create organizational unit",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  const unit = result.data;

  // Update cache immediately
  const now = new Date();
  await saveToCache({
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    description: unit.description ?? undefined,
    metadata: unit.metadata,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: now,
    lastSynced: now,
  });

  return unit;
}

/**
 * Update an organizational unit
 */
export async function updateOrganizationalUnit(
  id: string,
  data: UpdateOrganizationalUnitRequest
): Promise<OrganizationalUnit> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to update organizational unit",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  const unit = result.data;

  // Update cache immediately
  const now = new Date();
  await saveToCache({
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    description: unit.description ?? undefined,
    metadata: unit.metadata,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: now,
    lastSynced: now,
  });

  return unit;
}

/**
 * Delete an organizational unit
 */
export async function deleteOrganizationalUnit(id: string): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to delete organizational unit",
      response.status
    );
  }

  // Delete from cache immediately
  await deleteFromCache(id);
}

/**
 * Get descendants of an organizational unit
 */
export async function getOrganizationalUnitDescendants(
  id: string
): Promise<OrganizationalUnit[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/descendants`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch descendants",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get ancestors of an organizational unit
 */
export async function getOrganizationalUnitAncestors(
  id: string
): Promise<OrganizationalUnit[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/ancestors`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch ancestors",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Attach a parent to an organizational unit
 */
export async function attachOrganizationalUnitParent(
  id: string,
  parentId: string
): Promise<OrganizationalUnit> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/parent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ parent_id: parentId }),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to attach parent",
      response.status
    );
  }

  const result = await response.json();
  const unit = result.data;

  // Update cache immediately
  const now = new Date();
  await saveToCache({
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    description: unit.description ?? undefined,
    metadata: unit.metadata,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: now,
    lastSynced: now,
  });

  return unit;
}

/**
 * Detach a parent from an organizational unit
 */
export async function detachOrganizationalUnitParent(
  id: string,
  parentId: string
): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/parent/${parentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to detach parent",
      response.status
    );
  }

  // Fetch updated unit and update cache (delete first to avoid duplicates)
  const unit = await getOrganizationalUnit(id);
  await deleteFromCache(unit.id);
  const now = new Date();
  await saveToCache({
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    description: unit.description ?? undefined,
    metadata: unit.metadata,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: now,
    lastSynced: now,
  });
}

/**
 * Get current user's organizational scopes
 */
export async function getMyOrganizationalScopes(): Promise<
  UserOrganizationalScope[]
> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/me/organizational-scopes`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to fetch organizational scopes",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}
