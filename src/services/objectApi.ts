// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { fetchWithCsrf } from "./csrf";
import type {
  SecPalObject,
  ObjectArea,
  CreateObjectRequest,
  UpdateObjectRequest,
  CreateObjectAreaRequest,
  UpdateObjectAreaRequest,
  ObjectFilters,
  PaginatedResponse,
} from "../types/organizational";
import { ApiError } from "./secretApi";

/**
 * Object API Service
 *
 * Provides CRUD operations for physical objects (locations) and their areas.
 * Objects belong to customers and can have multiple areas with separate guard books.
 *
 * @see ADR-007: Organizational Structure Hierarchy
 */

// ============================================================================
// Object CRUD Operations
// ============================================================================

/**
 * List objects with optional filters
 */
export async function listObjects(
  filters?: ObjectFilters
): Promise<PaginatedResponse<SecPalObject>> {
  const params = new URLSearchParams();

  if (filters?.customer_id) {
    params.set("customer_id", filters.customer_id);
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/objects${queryString ? `?${queryString}` : ""}`;

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
      error.message || "Failed to fetch objects",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single object by ID
 */
export async function getObject(id: string): Promise<SecPalObject> {
  const response = await fetch(`${apiConfig.baseUrl}/v1/objects/${id}`, {
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
      error.message || "Failed to fetch object",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new object
 */
export async function createObject(
  data: CreateObjectRequest
): Promise<SecPalObject> {
  const response = await fetchWithCsrf(`${apiConfig.baseUrl}/v1/objects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Unknown error" }));
    throw new ApiError(
      error.message || "Failed to create object",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update an object
 */
export async function updateObject(
  id: string,
  data: UpdateObjectRequest
): Promise<SecPalObject> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/objects/${id}`,
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
      error.message || "Failed to update object",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete an object
 */
export async function deleteObject(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/objects/${id}`,
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
      error.message || "Failed to delete object",
      response.status
    );
  }
}

/**
 * Get areas of an object
 */
export async function getObjectAreas(objectId: string): Promise<ObjectArea[]> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/objects/${objectId}/areas`,
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
      error.message || "Failed to fetch object areas",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create an area for an object
 */
export async function createObjectArea(
  objectId: string,
  data: CreateObjectAreaRequest
): Promise<ObjectArea> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/objects/${objectId}/areas`,
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
      error.message || "Failed to create object area",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

// ============================================================================
// Object Area CRUD Operations
// ============================================================================

/**
 * List all object areas with optional filters
 */
export async function listObjectAreas(filters?: {
  object_id?: string;
  per_page?: number;
  page?: number;
}): Promise<PaginatedResponse<ObjectArea>> {
  const params = new URLSearchParams();

  if (filters?.object_id) {
    params.set("object_id", filters.object_id);
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/object-areas${queryString ? `?${queryString}` : ""}`;

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
      error.message || "Failed to fetch object areas",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single object area by ID
 */
export async function getObjectArea(id: string): Promise<ObjectArea> {
  const response = await fetch(`${apiConfig.baseUrl}/v1/object-areas/${id}`, {
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
      error.message || "Failed to fetch object area",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update an object area
 */
export async function updateObjectArea(
  id: string,
  data: UpdateObjectAreaRequest
): Promise<ObjectArea> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/object-areas/${id}`,
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
      error.message || "Failed to update object area",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete an object area
 */
export async function deleteObjectArea(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/object-areas/${id}`,
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
      error.message || "Failed to delete object area",
      response.status
    );
  }
}
