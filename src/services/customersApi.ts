// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer & Site Management API Services (Epic #210)
 *
 * This module provides API functions for Customer, Site, Assignment,
 * and CostCenter management. All 22 endpoints from contracts#71.
 */

import { apiFetch } from "./csrf";
import { apiConfig } from "../config";

/**
 * Formats validation errors from Laravel API into a readable error message
 */
function formatValidationErrors(error: {
  message?: string;
  errors?: Record<string, string[]>;
}): string {
  if (error.errors) {
    const validationEntries = Object.entries(error.errors);

    if (validationEntries.length > 0) {
      return validationEntries
        .map(
          ([field, messages]) =>
            `${field}: ${(messages as string[]).join(", ")}`
        )
        .join("\n");
    }
  }

  return error.message || "An error occurred";
}

import type {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
  Site,
  CreateSiteRequest,
  UpdateSiteRequest,
  SiteFilters,
  CustomerAssignment,
  CreateCustomerAssignmentRequest,
  UpdateCustomerAssignmentRequest,
  SiteAssignment,
  CreateSiteAssignmentRequest,
  UpdateSiteAssignmentRequest,
  CostCenter,
  CreateCostCenterRequest,
  UpdateCostCenterRequest,
  CostCenterFilters,
  PaginatedResponse,
} from "../types/customers";

// ============================================================================
// Customer API
// ============================================================================

/**
 * Lists customers with optional filters and pagination
 */
export async function listCustomers(
  filters?: CustomerFilters
): Promise<PaginatedResponse<Customer>> {
  const searchParams = new URLSearchParams();

  if (filters?.search) {
    searchParams.append("search", filters.search);
  }
  if (filters?.is_active !== undefined) {
    searchParams.append("is_active", filters.is_active ? "1" : "0");
  }
  if (filters?.page) {
    searchParams.append("page", filters.page.toString());
  }
  if (filters?.per_page) {
    searchParams.append("per_page", filters.per_page.toString());
  }

  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customers?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list customers");
  }

  const data = (await response
    .json()
    .catch(() => ({ data: [], meta: {} }))) as PaginatedResponse<Customer>;
  return data;
}

/**
 * Gets a single customer by ID
 */
export async function getCustomer(id: string): Promise<Customer> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/customers/${id}`);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to get customer");
  }

  const data = await response.json();
  if (!data.data) {
    console.error(
      "[getCustomer] Unexpected response structure:",
      JSON.stringify(data)
    );
    throw new Error("Failed to parse customer response");
  }
  return data.data as Customer;
}

/**
 * Creates a new customer
 */
export async function createCustomer(
  customerData: CreateCustomerRequest
): Promise<Customer> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));

    throw new Error(
      formatValidationErrors(error) || "Failed to create customer"
    );
  }

  const data = await response.json();
  if (!data.data) {
    console.error(
      "[createCustomer] Unexpected response structure:",
      JSON.stringify(data)
    );
    throw new Error("Failed to parse customer response");
  }
  return data.data as Customer;
}

/**
 * Updates an existing customer
 */
export async function updateCustomer(
  id: string,
  customerData: UpdateCustomerRequest
): Promise<Customer> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/customers/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(customerData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));

    throw new Error(
      formatValidationErrors(error) || "Failed to update customer"
    );
  }

  const data = await response.json();
  if (!data.data) {
    console.error(
      "[updateCustomer] Unexpected response structure:",
      JSON.stringify(data)
    );
    throw new Error("Failed to parse customer response");
  }
  return data.data as Customer;
}

/**
 * Deletes a customer (soft delete)
 */
export async function deleteCustomer(id: string): Promise<void> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/customers/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete customer");
  }
}

/**
 * Gets all sites for a specific customer
 */
export async function getCustomerSites(
  customerId: string,
  filters?: SiteFilters
): Promise<PaginatedResponse<Site>> {
  const searchParams = new URLSearchParams();

  if (filters?.search) {
    searchParams.append("search", filters.search);
  }
  if (filters?.is_active !== undefined) {
    searchParams.append("is_active", filters.is_active ? "1" : "0");
  }
  if (filters?.type) {
    searchParams.append("type", filters.type);
  }
  if (filters?.page) {
    searchParams.append("page", filters.page.toString());
  }
  if (filters?.per_page) {
    searchParams.append("per_page", filters.per_page.toString());
  }

  const response = await apiFetch(
    `/v1/customers/${customerId}/sites?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list customer sites");
  }

  const data = (await response
    .json()
    .catch(() => ({ data: [], meta: {} }))) as PaginatedResponse<Site>;
  return data;
}

// ============================================================================
// Site API
// ============================================================================

/**
 * Lists all sites with optional filters and pagination
 */
export async function listSites(
  filters?: SiteFilters
): Promise<PaginatedResponse<Site>> {
  const searchParams = new URLSearchParams();

  if (filters?.search) {
    searchParams.append("search", filters.search);
  }
  if (filters?.is_active !== undefined) {
    searchParams.append("is_active", filters.is_active ? "1" : "0");
  }
  if (filters?.customer_id) {
    searchParams.append("customer_id", filters.customer_id.toString());
  }
  if (filters?.organizational_unit_id) {
    searchParams.append(
      "organizational_unit_id",
      filters.organizational_unit_id.toString()
    );
  }
  if (filters?.type) {
    searchParams.append("type", filters.type);
  }
  if (filters?.page) {
    searchParams.append("page", filters.page.toString());
  }
  if (filters?.per_page) {
    searchParams.append("per_page", filters.per_page.toString());
  }

  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/sites?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list sites");
  }

  const data = (await response
    .json()
    .catch(() => ({ data: [], meta: {} }))) as PaginatedResponse<Site>;
  return data;
}

/**
 * Gets a single site by ID
 */
export async function getSite(id: string): Promise<Site> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/sites/${id}`);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to get site");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse site response");
  }
  return data.data as Site;
}

/**
 * Creates a new site
 */
export async function createSite(siteData: CreateSiteRequest): Promise<Site> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/sites`, {
    method: "POST",
    body: JSON.stringify(siteData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create site");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse site response");
  }
  return data.data as Site;
}

/**
 * Updates an existing site
 */
export async function updateSite(
  id: string,
  siteData: UpdateSiteRequest
): Promise<Site> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/sites/${id}`, {
    method: "PATCH",
    body: JSON.stringify(siteData),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update site");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse site response");
  }
  return data.data as Site;
}

/**
 * Deletes a site (soft delete)
 */
export async function deleteSite(id: string): Promise<void> {
  const response = await apiFetch(`${apiConfig.baseUrl}/v1/sites/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete site");
  }
}

/**
 * Gets all cost centers for a specific site
 */
export async function getSiteCostCenters(
  siteId: string,
  filters?: CostCenterFilters
): Promise<PaginatedResponse<CostCenter>> {
  const searchParams = new URLSearchParams();

  if (filters?.search) {
    searchParams.append("search", filters.search);
  }
  if (filters?.is_active !== undefined) {
    searchParams.append("is_active", filters.is_active ? "1" : "0");
  }
  if (filters?.activity_type) {
    searchParams.append("activity_type", filters.activity_type);
  }
  if (filters?.page) {
    searchParams.append("page", filters.page.toString());
  }
  if (filters?.per_page) {
    searchParams.append("per_page", filters.per_page.toString());
  }

  const response = await apiFetch(
    `/v1/sites/${siteId}/cost-centers?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list cost centers");
  }

  const data = (await response
    .json()
    .catch(() => ({ data: [], meta: {} }))) as PaginatedResponse<CostCenter>;
  return data;
}

// ============================================================================
// Customer Assignment API
// ============================================================================

/**
 * Lists customer assignments for a specific customer
 */
export async function listCustomerAssignments(
  customerId: string,
  activeOnly?: boolean
): Promise<CustomerAssignment[]> {
  const searchParams = new URLSearchParams();

  if (activeOnly !== undefined) {
    searchParams.append("active_only", activeOnly ? "1" : "0");
  }

  const response = await apiFetch(
    `/v1/customers/${customerId}/assignments?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list customer assignments");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return (data.data || []) as CustomerAssignment[];
}

/**
 * Creates a new customer assignment
 */
export async function createCustomerAssignment(
  customerId: string,
  assignmentData: CreateCustomerAssignmentRequest
): Promise<CustomerAssignment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customers/${customerId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify(assignmentData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create customer assignment");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse customer assignment response");
  }
  return data.data as CustomerAssignment;
}

/**
 * Updates an existing customer assignment
 */
export async function updateCustomerAssignment(
  id: string,
  assignmentData: UpdateCustomerAssignmentRequest
): Promise<CustomerAssignment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-assignments/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(assignmentData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update customer assignment");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse customer assignment response");
  }
  return data.data as CustomerAssignment;
}

/**
 * Deletes a customer assignment
 */
export async function deleteCustomerAssignment(id: string): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-assignments/${id}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete customer assignment");
  }
}

// ============================================================================
// Site Assignment API
// ============================================================================

/**
 * Lists site assignments for a specific site
 */
export async function listSiteAssignments(
  siteId: string,
  activeOnly?: boolean
): Promise<SiteAssignment[]> {
  const searchParams = new URLSearchParams();

  if (activeOnly !== undefined) {
    searchParams.append("active_only", activeOnly ? "1" : "0");
  }

  const response = await apiFetch(
    `/v1/sites/${siteId}/assignments?${searchParams.toString()}`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list site assignments");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return (data.data || []) as SiteAssignment[];
}

/**
 * Creates a new site assignment
 */
export async function createSiteAssignment(
  siteId: string,
  assignmentData: CreateSiteAssignmentRequest
): Promise<SiteAssignment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/sites/${siteId}/assignments`,
    {
      method: "POST",
      body: JSON.stringify(assignmentData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create site assignment");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse site assignment response");
  }
  return data.data as SiteAssignment;
}

/**
 * Updates an existing site assignment
 */
export async function updateSiteAssignment(
  id: string,
  assignmentData: UpdateSiteAssignmentRequest
): Promise<SiteAssignment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/site-assignments/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(assignmentData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update site assignment");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse site assignment response");
  }
  return data.data as SiteAssignment;
}

/**
 * Deletes a site assignment
 */
export async function deleteSiteAssignment(id: string): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/site-assignments/${id}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete site assignment");
  }
}

// ============================================================================
// Cost Center API
// ============================================================================

/**
 * Creates a new cost center
 */
export async function createCostCenter(
  siteId: string,
  costCenterData: CreateCostCenterRequest
): Promise<CostCenter> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/sites/${siteId}/cost-centers`,
    {
      method: "POST",
      body: JSON.stringify(costCenterData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create cost center");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse cost center response");
  }
  return data.data as CostCenter;
}

/**
 * Updates an existing cost center
 */
export async function updateCostCenter(
  siteId: string,
  id: string,
  costCenterData: UpdateCostCenterRequest
): Promise<CostCenter> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/sites/${siteId}/cost-centers/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(costCenterData),
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update cost center");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse cost center response");
  }
  return data.data as CostCenter;
}

/**
 * Deletes a cost center
 */
export async function deleteCostCenter(
  siteId: string,
  id: string
): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/sites/${siteId}/cost-centers/${id}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete cost center");
  }
}

// ============================================================================
// User Assignments API (My assignments)
// ============================================================================

/**
 * Gets customer assignments for the authenticated user
 */
export async function getMyCustomerAssignments(): Promise<
  CustomerAssignment[]
> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/me/customer-assignments`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to get user customer assignments");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return (data.data || []) as CustomerAssignment[];
}

/**
 * Gets site assignments for the authenticated user
 */
export async function getMySiteAssignments(): Promise<SiteAssignment[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/me/site-assignments`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to get user site assignments");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return (data.data || []) as SiteAssignment[];
}
