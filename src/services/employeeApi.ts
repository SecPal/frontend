// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  Employee,
  EmployeeFilters,
  EmployeeFormData,
  EmployeeListResponse,
  ValidationErrorResponse,
} from "@/types/api";
import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError } from "./ApiError";

export interface ConfirmEmployeeOnboardingPayload {
  notes?: string;
}

/**
 * Fetch paginated list of employees
 */
export async function fetchEmployees(
  filters?: EmployeeFilters
): Promise<EmployeeListResponse> {
  const params = new URLSearchParams();

  if (filters?.status) params.append("status", filters.status);
  if (filters?.organizational_unit_id)
    params.append("organizational_unit_id", filters.organizational_unit_id);
  if (filters?.search) params.append("search", filters.search);
  if (filters?.page) params.append("page", filters.page.toString());
  if (filters?.per_page) params.append("per_page", filters.per_page.toString());

  const url = `${apiConfig.baseUrl}/v1/employees?${params.toString()}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to fetch employees",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({
    data: [],
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
  }));
  if (!data.data) {
    throw new ApiError("Failed to parse employees list response");
  }
  return data;
}

/**
 * Fetch single employee by ID
 */
export async function fetchEmployee(id: string): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/employees/${id}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to fetch employee",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse employee response");
  }
  return data.data;
}

/**
 * Create new employee
 */
export async function createEmployee(
  employee: EmployeeFormData
): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/employees`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(employee),
  });

  if (!response.ok) {
    // Try to parse validation errors (422) or other JSON errors
    const error: Partial<ValidationErrorResponse> = await response
      .json()
      .catch(() => ({
        message: response.statusText,
        errors: {},
      }));

    // Handle Laravel validation errors (422)
    if (response.status === 422 && error.errors) {
      // Format validation errors for display
      const errorMessages = Object.entries(error.errors)
        .map(([field, messages]: [string, string[]]) => {
          const fieldName = field.replace(/_/g, " ");
          return `${fieldName}: ${Array.isArray(messages) ? messages.join(", ") : messages}`;
        })
        .join("; ");
      throw new ApiError(
        errorMessages || error.message || "Validation failed",
        response.status,
        Object.keys(error.errors).length > 0 ? error.errors : undefined,
        response
      );
    }

    throw new ApiError(
      error.message || "Failed to create employee",
      response.status,
      response
    );
  }

  const data = await response.json().catch((err) => {
    if (import.meta.env.DEV) {
      console.error("Failed to parse employee response:", err);
      console.error("Response status:", response.status);
      console.error(
        "Response headers:",
        Array.from(response.headers.entries())
      );
    }
    return { data: null };
  });

  if (!data.data) {
    throw new ApiError(
      `API returned status ${response.status} but response has no 'data' field. Check console for details.`,
      response.status,
      response
    );
  }
  return data.data;
}

/**
 * Update existing employee
 */
export async function updateEmployee(
  id: string,
  employee: Partial<EmployeeFormData>
): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/employees/${id}`;
  const response = await apiFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(employee),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to update employee",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse employee response");
  }
  return data.data;
}

/**
 * Delete employee (soft delete)
 */
export async function deleteEmployee(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/employees/${id}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to delete employee",
      response.status,
      response
    );
  }
}

/**
 * Activate employee (transition to active status)
 */
export async function activateEmployee(id: string): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/employees/${id}/activate`;
  const response = await apiFetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to activate employee",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse employee response");
  }
  return data.data;
}

/**
 * Confirm onboarding dossier for a pre-contract employee.
 */
export async function confirmEmployeeOnboarding(
  id: string,
  payload?: ConfirmEmployeeOnboardingPayload
): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/admin/onboarding/employees/${id}/confirm`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to confirm onboarding",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse employee response");
  }
  return data.data;
}

/**
 * Terminate employee (immediate deactivation)
 */
export async function terminateEmployee(id: string): Promise<Employee> {
  const url = `${apiConfig.baseUrl}/v1/employees/${id}/terminate`;
  const response = await apiFetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to terminate employee",
      response.status,
      response
    );
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new ApiError("Failed to parse employee response");
  }
  return data.data;
}
