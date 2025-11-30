// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { fetchWithCsrf } from "./csrf";
import type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
  PaginatedResponse,
} from "../types/organizational";
import { ApiError } from "./secretApi";

/**
 * Customer API Service
 *
 * Provides CRUD operations and hierarchy management for external
 * customer organizations (corporate, regional, local).
 *
 * Note: Customer users (Client role) have read-only access.
 * Internal employees have full CRUD access based on organizational scopes.
 *
 * @see ADR-007: Organizational Structure Hierarchy
 */

/**
 * List customers with optional filters
 */
export async function listCustomers(
  filters?: CustomerFilters
): Promise<PaginatedResponse<Customer>> {
  const params = new URLSearchParams();

  if (filters?.type) {
    params.set("type", filters.type);
  }
  if (filters?.managed_by) {
    params.set("managed_by", filters.managed_by);
  }
  if (filters?.per_page) {
    params.set("per_page", String(filters.per_page));
  }
  if (filters?.page) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const url = `${apiConfig.baseUrl}/v1/customers${queryString ? `?${queryString}` : ""}`;

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
      error.message || "Failed to fetch customers",
      response.status
    );
  }

  return response.json();
}

/**
 * Get a single customer by ID
 */
export async function getCustomer(id: string): Promise<Customer> {
  const response = await fetch(`${apiConfig.baseUrl}/v1/customers/${id}`, {
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
      error.message || "Failed to fetch customer",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Create a new customer
 */
export async function createCustomer(
  data: CreateCustomerRequest
): Promise<Customer> {
  const response = await fetchWithCsrf(`${apiConfig.baseUrl}/v1/customers`, {
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
      error.message || "Failed to create customer",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update a customer
 */
export async function updateCustomer(
  id: string,
  data: UpdateCustomerRequest
): Promise<Customer> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/customers/${id}`,
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
      error.message || "Failed to update customer",
      response.status,
      error.errors
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Delete a customer
 */
export async function deleteCustomer(id: string): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/customers/${id}`,
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
      error.message || "Failed to delete customer",
      response.status
    );
  }
}

/**
 * Get descendants of a customer
 */
export async function getCustomerDescendants(id: string): Promise<Customer[]> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/customers/${id}/descendants`,
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
      error.message || "Failed to fetch customer descendants",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Get ancestors of a customer
 */
export async function getCustomerAncestors(id: string): Promise<Customer[]> {
  const response = await fetch(
    `${apiConfig.baseUrl}/v1/customers/${id}/ancestors`,
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
      error.message || "Failed to fetch customer ancestors",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Attach a parent to a customer
 */
export async function attachCustomerParent(
  id: string,
  parentId: string
): Promise<Customer> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/customers/${id}/parent`,
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
      error.message || "Failed to attach customer parent",
      response.status
    );
  }

  const result = await response.json();
  return result.data;
}

/**
 * Detach a parent from a customer
 */
export async function detachCustomerParent(
  id: string,
  parentId: string
): Promise<void> {
  const response = await fetchWithCsrf(
    `${apiConfig.baseUrl}/v1/customers/${id}/parent/${parentId}`,
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
      error.message || "Failed to detach customer parent",
      response.status
    );
  }
}
