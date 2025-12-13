// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";

/**
 * Employee status types
 */
export type EmployeeStatus =
  | "pre_contract"
  | "active"
  | "on_leave"
  | "terminated";

/**
 * Employee API Response Types
 */
export interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  hire_date?: string;
  contract_start_date: string;
  contract_end_date?: string;
  position: string;
  status: EmployeeStatus;
  organizational_unit: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Paginated employee list response
 */
export interface EmployeeListResponse {
  data: Employee[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/**
 * Employee create/update request
 */
export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  contract_start_date: string;
  contract_end_date?: string;
  position: string;
  organizational_unit_id: string;
  hire_date?: string;
}

/**
 * Employee list filters
 */
export interface EmployeeFilters {
  status?: EmployeeStatus;
  organizational_unit_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
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
    throw new Error(error.message || "Failed to fetch employees");
  }

  return response.json();
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
    throw new Error(error.message || "Failed to fetch employee");
  }

  const data = await response.json();
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
    },
    body: JSON.stringify(employee),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create employee");
  }

  const data = await response.json();
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
    throw new Error(error.message || "Failed to update employee");
  }

  const data = await response.json();
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
    throw new Error(error.message || "Failed to delete employee");
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
    throw new Error(error.message || "Failed to activate employee");
  }

  const data = await response.json();
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
    throw new Error(error.message || "Failed to terminate employee");
  }

  const data = await response.json();
  return data.data;
}
