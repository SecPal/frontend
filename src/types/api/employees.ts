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
  "applicant" | "pre_contract" | "active" | "on_leave" | "terminated";

export type EmployeeContractType =
  "full_time" | "part_time" | "minijob" | "freelance";

export type EmployeeBwrStatus =
  "not_registered" | "pending" | "active" | "suspended" | "revoked";

export type EmployeeBwrManagedStatus = Exclude<
  EmployeeBwrStatus,
  "not_registered"
>;

export type EmployeeBwrExportFormat = "csv" | "xml";

export interface EmployeeEmergencyContact {
  name: string;
  relationship?: string | null;
  phone: string;
  email?: string | null;
  notes?: string | null;
}

/** Writable address row (create/update); omit `id`. */
export interface EmployeeAddressInput {
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  supplement?: string | null;
  country?: string | null;
  state?: string | null;
  resided_from?: string | null;
  resided_until?: string | null;
}

/** Address returned on employee resources (includes primary key). */
export interface EmployeeAddress extends EmployeeAddressInput {
  id: string;
}

export interface EmployeeUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface EmployeeOrganizationalUnitSummary {
  id: string;
  name: string;
}

export type EmployeeOnboardingInvitationStatus =
  "not_requested" | "sent" | "created_not_sent" | "failed";

export type EmployeeOnboardingWorkflowStatus =
  | "invited"
  | "account_initialized"
  | "in_progress"
  | "submitted_for_review"
  | "changes_requested"
  | "contract_confirmed"
  | "ready_for_activation"
  | "active";

export interface EmployeeOnboardingWorkflow {
  status: EmployeeOnboardingWorkflowStatus;
}

export interface EmployeeOnboardingInvitation {
  status: EmployeeOnboardingInvitationStatus;
  available?: boolean;
  eligible_statuses?: EmployeeStatus[];
  rule_message?: string | null;
  requested_at?: string | null;
  token_created_at?: string | null;
  mail_sent_at?: string | null;
  mail_failed_at?: string | null;
  failure_reason?: string | null;
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
  addresses?: EmployeeAddress[] | null;
  current_address?: EmployeeAddress | null;
  structured_address?: string | null;
  emergency_contacts?: EmployeeEmergencyContact[] | null;
  date_of_birth: string | null;
  hire_date?: string | null;
  contract_start_date: string | null;
  termination_date?: string | null;
  last_working_day?: string | null;
  position?: string | null;
  bwr_id?: string | null;
  bwr_status?: EmployeeBwrStatus | null;
  bwr_registered_at?: string | null;
  bwr_submission_date?: string | null;
  bwr_notes?: string | null;
  status: EmployeeStatus;
  contract_type: EmployeeContractType;
  organizational_unit_id?: string | null;
  organizational_unit: EmployeeOrganizationalUnitSummary | null;
  management_level: number;
  user?: EmployeeUserSummary | null;
  user_id?: string | null;
  user_account_active?: boolean;
  onboarding_completed?: boolean;
  onboarding_workflow?: EmployeeOnboardingWorkflow | null;
  onboarding_invitation?: EmployeeOnboardingInvitation;
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
  addresses?: EmployeeAddressInput[] | null;
  emergency_contacts?: EmployeeEmergencyContact[] | null;
  date_of_birth: string;
  contract_start_date: string;
  position: string;
  organizational_unit_id: string;
  management_level: number;
  hire_date?: string;
  status: EmployeeStatus;
  contract_type: EmployeeContractType;
  send_invitation?: boolean;
}

export interface ValidationErrorResponse {
  message: string;
  errors: Record<string, string[]>;
}

export interface EmployeeBwrExportResponse {
  employee_id: string;
  status: EmployeeBwrStatus | null;
  format: EmployeeBwrExportFormat;
  download_url: string;
}

export interface EmployeeBwrStatusUpdatePayload {
  status: EmployeeBwrManagedStatus;
  bwr_id?: string | null;
  notes?: string | null;
}

export interface EmployeeFilters {
  status?: EmployeeStatus;
  organizational_unit_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}
