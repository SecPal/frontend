// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { fetchWithCsrf } from "./csrf";
import type {
  OrganizationalUnit,
  CreateOrganizationalUnitRequest,
  UpdateOrganizationalUnitRequest,
  OrganizationalUnitFilters,
  PaginatedResponse,
  UserOrganizationalScope,
} from "../types/organizational";
import { ApiError } from "./secretApi";

/**
 * Organizational Unit API Service
 *
 * Provides CRUD operations and hierarchy management for internal
 * organizational units (holdings, companies, regions, branches, etc.).
 *
 * @see ADR-007: Organizational Structure Hierarchy
 */

/**
 * List organizational units with optional filters
 */
export async function listOrganizationalUnits(
  filters?: OrganizationalUnitFilters
): Promise<PaginatedResponse<OrganizationalUnit>> {
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

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
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
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/organizational-units`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  return result.data;
}

/**
 * Update an organizational unit
 */
export async function updateOrganizationalUnit(
  id: string,
  data: UpdateOrganizationalUnitRequest
): Promise<OrganizationalUnit> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  return result.data;
}

/**
 * Delete an organizational unit
 */
export async function deleteOrganizationalUnit(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
}

/**
 * Get descendants of an organizational unit
 */
export async function getOrganizationalUnitDescendants(
  id: string
): Promise<OrganizationalUnit[]> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/descendants`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/ancestors`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/parent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
  return result.data;
}

/**
 * Detach a parent from an organizational unit
 */
export async function detachOrganizationalUnitParent(
  id: string,
  parentId: string
): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/organizational-units/${id}/parent/${parentId}`,
    {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
}

/**
 * Get current user's organizational scopes
 */
export async function getMyOrganizationalScopes(): Promise<
  UserOrganizationalScope[]
> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/me/organizational-scopes`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
