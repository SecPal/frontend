// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { apiFetch, getCsrfTokenFromCookie } from "./csrf";

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
 * Onboarding completion request (magic link)
 */
export interface OnboardingCompleteData {
  token: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  password_confirmation: string;
  photo?: File;
}

/**
 * Onboarding token validation response (for prefilling form)
 */
export interface OnboardingTokenValidationResponse {
  data: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

/**
 * Onboarding completion response
 */
export interface OnboardingCompleteResponse {
  message: string;
  data: {
    token: string;
    user: {
      id: number;
      email: string;
      name: string;
    };
    employee: {
      id: number;
      first_name: string;
      last_name: string;
      status: string;
    };
  };
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
  if (!data.data) {
    throw new Error("Failed to parse onboarding steps response");
  }
  return data.data;
}

/**
 * Validate onboarding token and get employee data for prefilling
 *
 * GET /v1/onboarding/validate-token?token=xxx&email=xxx (public endpoint, no auth)
 *
 * Security: Both token AND email must match to prevent token hijacking.
 *
 * @param token - Onboarding token from magic link
 * @param email - Email address from magic link
 * @returns Employee data for prefilling form (first_name, last_name, email)
 * @throws Error if token is invalid, expired, or email doesn't match
 */
export async function validateOnboardingToken(
  token: string,
  email: string
): Promise<OnboardingTokenValidationResponse> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/validate-token?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Invalid or expired onboarding token");
  }

  return response.json();
}

/**
 * Complete onboarding with magic link token
 *
 * POST /v1/onboarding/complete (public endpoint, no auth)
 *
 * @param data - Onboarding completion data including token, credentials, and optional photo
 * @returns Response containing Sanctum token and user/employee data
 * @throws Error if onboarding fails (invalid token, validation errors, etc.)
 */
export async function completeOnboarding(
  data: OnboardingCompleteData
): Promise<OnboardingCompleteResponse> {
  // Fetch CSRF cookie first (required by Laravel Sanctum SPA auth)
  const csrfResponse = await fetch(`${apiConfig.baseUrl}/sanctum/csrf-cookie`, {
    credentials: "include",
  });

  if (!csrfResponse.ok) {
    throw new Error("Failed to fetch CSRF token");
  }

  const formData = new FormData();

  formData.append("token", data.token);
  formData.append("email", data.email);
  formData.append("first_name", data.first_name);
  formData.append("last_name", data.last_name);
  formData.append("password", data.password);
  formData.append("password_confirmation", data.password_confirmation);

  if (data.photo) {
    formData.append("photo", data.photo);
  }

  // Get CSRF token from cookie using centralized utility
  const token = getCsrfTokenFromCookie();

  const response = await fetch(`${apiConfig.baseUrl}/v1/onboarding/complete`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: token ? { "X-XSRF-TOKEN": token } : {},
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: response.statusText,
    }));
    throw {
      response: {
        status: response.status,
        data: error,
      },
    };
  }

  return response.json();
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

  const data = await response.json().catch(() => ({ data: null }));
  if (!data.data) {
    throw new Error("Failed to parse onboarding template response");
  }
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
  if (!data.data) {
    throw new Error("Failed to parse file upload response");
  }
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
  if (!data.data) {
    throw new Error("Failed to parse approval response");
  }
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
  if (!data.data) {
    throw new Error("Failed to parse rejection response");
  }
  return data.data;
}
