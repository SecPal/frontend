// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";

/**
 * Qualification category types
 */
export type QualificationCategory =
  | "bewachv_34a"
  | "first_aid"
  | "fire_safety"
  | "safety_officer"
  | "specialized"
  | "education";

/**
 * Qualification API Response Types
 */
export interface Qualification {
  id: string;
  name: string;
  category?: QualificationCategory;
  description?: string;
  requires_certificate: boolean;
  has_expiry_date: boolean;
  is_system_qualification: boolean;
}

/**
 * Employee Qualification (pivot data)
 */
export interface EmployeeQualification {
  id: string;
  employee_id: string;
  qualification_id: string;
  qualification: Qualification;
  certificate_number?: string;
  issued_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  status: "valid" | "expired" | "pending";
  notes?: string;
}

/**
 * Qualification create request
 */
export interface QualificationFormData {
  name: string;
  category?: QualificationCategory;
  description?: string;
  requires_certificate: boolean;
  has_expiry_date: boolean;
}

/**
 * Attach qualification to employee request
 */
export interface AttachQualificationData {
  qualification_id: string;
  certificate_number?: string;
  issued_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  notes?: string;
}

/**
 * Fetch all qualifications
 */
export async function fetchQualifications(filters?: {
  is_system_qualification?: boolean;
  category?: QualificationCategory;
}): Promise<Qualification[]> {
  const params = new URLSearchParams();

  if (filters?.is_system_qualification !== undefined) {
    params.append(
      "is_system_qualification",
      filters.is_system_qualification.toString()
    );
  }
  if (filters?.category) {
    params.append("category", filters.category);
  }

  const url = `${apiConfig.baseUrl}/v1/qualifications?${params.toString()}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch qualifications");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse qualifications response");
  }
  return data.data;
}

/**
 * Fetch single qualification
 */
export async function fetchQualification(id: string): Promise<Qualification> {
  const url = `${apiConfig.baseUrl}/v1/qualifications/${id}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch qualification");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse qualification response");
  }
  return data.data;
}

/**
 * Create custom qualification (HR only)
 */
export async function createQualification(
  qualification: QualificationFormData
): Promise<Qualification> {
  const url = `${apiConfig.baseUrl}/v1/qualifications`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(qualification),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to create qualification");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse qualification response");
  }
  return data.data;
}

/**
 * Update custom qualification
 */
export async function updateQualification(
  id: string,
  qualification: Partial<QualificationFormData>
): Promise<Qualification> {
  const url = `${apiConfig.baseUrl}/v1/qualifications/${id}`;
  const response = await apiFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(qualification),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update qualification");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse qualification response");
  }
  return data.data;
}

/**
 * Delete custom qualification
 */
export async function deleteQualification(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/qualifications/${id}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to delete qualification");
  }
}

/**
 * Fetch employee qualifications
 */
export async function fetchEmployeeQualifications(
  employeeId: string
): Promise<EmployeeQualification[]> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/qualifications`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch employee qualifications");
  }

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse employee qualifications response");
  }
  return data.data;
}

/**
 * Attach qualification to employee
 */
export async function attachQualification(
  employeeId: string,
  data: AttachQualificationData
): Promise<EmployeeQualification> {
  const url = `${apiConfig.baseUrl}/v1/employees/${employeeId}/qualifications`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to attach qualification");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update employee qualification details
 */
export async function updateEmployeeQualification(
  id: string,
  data: Partial<AttachQualificationData>
): Promise<EmployeeQualification> {
  const url = `${apiConfig.baseUrl}/v1/employee-qualifications/${id}`;
  const response = await apiFetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to update employee qualification");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Detach qualification from employee
 */
export async function detachQualification(id: string): Promise<void> {
  const url = `${apiConfig.baseUrl}/v1/employee-qualifications/${id}`;
  const response = await apiFetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to detach qualification");
  }
}
