// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Employee API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml`.
 * The employee contract was aligned with backend runtime behavior in
 * SecPal/contracts#117.
 */

export type EmployeeStatus =
  | "applicant"
  | "pre_contract"
  | "active"
  | "on_leave"
  | "terminated";

export type EmployeeContractType =
  | "full_time"
  | "part_time"
  | "minijob"
  | "freelance";

export interface EmployeeUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface EmployeeOrganizationalUnitSummary {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  tenant_id?: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string | null;
  date_of_birth: string;
  hire_date?: string | null;
  contract_start_date: string;
  termination_date?: string | null;
  last_working_day?: string | null;
  position?: string | null;
  status: EmployeeStatus;
  contract_type: EmployeeContractType;
  organizational_unit_id?: string | null;
  organizational_unit: EmployeeOrganizationalUnitSummary;
  management_level: number;
  user?: EmployeeUserSummary | null;
  user_id?: string | null;
  user_account_active?: boolean;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface EmployeeListResponse {
  data: Employee[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number | null;
    to?: number | null;
  };
}

export interface EmployeeFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  contract_start_date: string;
  position?: string;
  organizational_unit_id: string;
  management_level: number;
  hire_date?: string;
  status: EmployeeStatus;
  contract_type: EmployeeContractType;
}

export interface ValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}

export interface EmployeeFilters {
  status?: EmployeeStatus;
  organizational_unit_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}
