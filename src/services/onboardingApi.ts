// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch } from "./csrf";

/**
 * Onboarding Step
 */
export interface OnboardingStep {
  step_number: number;
  title: string;
  description?: string;
  template_id: string;
  is_completed: boolean;
}

/**
 * Onboarding Form Template
 */
export interface OnboardingFormTemplate {
  id: string;
  title: string;
  description?: string;
  step_number: number;
  form_schema: Record<string, unknown>;
  is_system_template: boolean;
}

/**
 * Onboarding Form Submission
 */
export interface OnboardingSubmission {
  id: string;
  employee_id: string;
  template_id: string;
  template: OnboardingFormTemplate;
  form_data: Record<string, unknown>;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at?: string;
  approved_at?: string;
  approved_by?: {
    id: string;
    name: string;
  };
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Onboarding submission create/update request
 */
export interface OnboardingSubmissionData {
  template_id: string;
  form_data: Record<string, unknown>;
  status?: "draft" | "submitted";
}

/**
 * Get onboarding steps for current pre-contract user
 */
export async function fetchOnboardingSteps(): Promise<OnboardingStep[]> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/steps`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch onboarding steps");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return data.data;
}

/**
 * Get onboarding form template
 */
export async function fetchOnboardingTemplate(
  templateId: string
): Promise<OnboardingFormTemplate> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/forms/${templateId}`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch onboarding template");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  return data.data;
}

/**
 * Submit onboarding form
 */
export async function createOnboardingSubmission(
  data: OnboardingSubmissionData
): Promise<OnboardingSubmission> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/submissions`;
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
    throw new Error(error.message || "Failed to create onboarding submission");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Update onboarding submission (draft only)
 */
export async function updateOnboardingSubmission(
  submissionId: string,
  data: Partial<OnboardingSubmissionData>
): Promise<OnboardingSubmission> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/submissions/${submissionId}`;
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
    throw new Error(error.message || "Failed to update onboarding submission");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Upload file to onboarding submission
 */
export async function uploadOnboardingFile(
  submissionId: string,
  file: File,
  documentType: string
): Promise<{ id: string; filename: string }> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/submissions/${submissionId}/files`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("document_type", documentType);

  const response = await apiFetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to upload file");
  }

  const data = await response.json().catch(() => ({ data: null }));
  return data.data;
}

/**
 * Approve onboarding submission (HR only)
 */
export async function approveOnboardingSubmission(
  submissionId: string
): Promise<OnboardingSubmission> {
  const url = `${apiConfig.baseUrl}/v1/admin/onboarding/submissions/${submissionId}/approve`;
  const response = await apiFetch(url, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to approve submission");
  }

  const data = await response.json().catch(() => ({ data: null }));
  return data.data;
}

/**
 * Reject onboarding submission (HR only)
 */
export async function rejectOnboardingSubmission(
  submissionId: string,
  reason: string
): Promise<OnboardingSubmission> {
  const url = `${apiConfig.baseUrl}/v1/admin/onboarding/submissions/${submissionId}/reject`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to reject submission");
  }

  const data = await response.json().catch(() => ({ data: null }));
  return data.data;
}
