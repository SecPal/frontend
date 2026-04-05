// SPDX-FileCopyrightText: 2025-2026 SecPal
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
  submission?: OnboardingSubmission | null;
}

/**
 * Onboarding Form Template
 */
export interface OnboardingFormTemplate {
  id: string;
  tenant_id?: number | null;
  name: string;
  title?: string;
  description?: string | null;
  step_number?: number;
  form_schema: Record<string, unknown>;
  is_required: boolean;
  is_system_template: boolean;
  sort_order: number;
  can_be_deleted: boolean;
  can_be_edited: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

/**
 * Onboarding Form Submission
 */
export interface OnboardingSubmission {
  id: string;
  employee_id: string;
  form_template_id: string;
  template_id?: string;
  form_data: Record<string, unknown> | null;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by?: {
    id: string;
    name: string;
  } | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  review_notes?: string | null;
  form_template?: OnboardingFormTemplate | null;
  template?: OnboardingFormTemplate | null;
  reviewer?: {
    id: string;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

/**
 * Onboarding submission create/update request
 */
export interface OnboardingSubmissionData {
  template_id?: string;
  form_template_id: string;
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
    user: {
      id: string | number;
      email: string;
      name: string;
    };
    employee: {
      id: string | number;
      first_name: string;
      last_name: string;
      status: string;
    };
  };
}

export interface OnboardingApiErrorData {
  message?: string;
  errors?: Record<string, string[]>;
}

export interface OnboardingApiError {
  response: {
    status: number;
    data: OnboardingApiErrorData;
    retryAfterSeconds?: number;
  };
}

async function parseErrorData(
  response: Response
): Promise<OnboardingApiErrorData> {
  return response.json().catch(() => ({ message: response.statusText }));
}

function buildOnboardingApiError(
  response: Response,
  data: OnboardingApiErrorData
): OnboardingApiError {
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : Number.NaN;

  return {
    response: {
      status: response.status,
      data,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : undefined,
    },
  };
}

function normalizeOnboardingTemplate(
  template: OnboardingFormTemplate
): OnboardingFormTemplate {
  return {
    ...template,
    title: template.title ?? template.name,
    step_number: template.step_number ?? template.sort_order,
  };
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
 * @throws {OnboardingApiError} with response.status (e.g. 401, 429) and optional retryAfterSeconds
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
    const error = await parseErrorData(response);
    throw buildOnboardingApiError(response, error);
  }

  return response.json();
}

/**
 * Complete onboarding with magic link token
 *
 * POST /v1/onboarding/complete (public endpoint, no auth)
 *
 * @param data - Onboarding completion data for the public bootstrap flow
 * @returns Response containing user and employee data for the new session
 * @throws {OnboardingApiError} with response.status (422 for validation errors, 429 for rate limit) and optional retryAfterSeconds
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

  // Get CSRF token from cookie using centralized utility
  const token = getCsrfTokenFromCookie();

  const response = await fetch(`${apiConfig.baseUrl}/v1/onboarding/complete`, {
    method: "POST",
    body: JSON.stringify(data),
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-XSRF-TOKEN": token } : {}),
    },
  });

  if (!response.ok) {
    const error = await parseErrorData(response);
    throw buildOnboardingApiError(response, error);
  }

  return response.json();
}

/**
 * Get onboarding steps for current pre-contract user
 */
export async function fetchOnboardingSteps(): Promise<OnboardingStep[]> {
  const [templates, submissions] = await Promise.all([
    fetchOnboardingTemplates(),
    fetchOnboardingSubmissions(),
  ]);

  return [...templates]
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((template, index) => {
      const submission =
        submissions.find((entry) => entry.form_template_id === template.id) ??
        null;

      return {
        step_number: index + 1,
        title: template.name,
        description: template.description ?? undefined,
        template_id: template.id,
        is_completed:
          submission !== null &&
          ["submitted", "approved"].includes(submission.status),
        submission,
      };
    });
}

/**
 * List onboarding form templates for the current employee
 */
export async function fetchOnboardingTemplates(): Promise<
  OnboardingFormTemplate[]
> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/templates`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch onboarding templates");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  if (!Array.isArray(data.data)) {
    throw new Error("Failed to parse onboarding templates response");
  }

  return data.data.map(normalizeOnboardingTemplate);
}

/**
 * Get onboarding form template
 */
export async function fetchOnboardingTemplate(
  templateId: string
): Promise<OnboardingFormTemplate> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/templates/${templateId}`;
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
  return normalizeOnboardingTemplate(data.data);
}

/**
 * List onboarding form submissions for the current employee
 */
export async function fetchOnboardingSubmissions(): Promise<
  OnboardingSubmission[]
> {
  const url = `${apiConfig.baseUrl}/v1/onboarding/submissions`;
  const response = await apiFetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to fetch onboarding submissions");
  }

  const data = await response.json().catch(() => ({ data: [] }));
  if (!Array.isArray(data.data)) {
    throw new Error("Failed to parse onboarding submissions response");
  }

  return data.data;
}

/**
 * Submit onboarding form
 */
export async function createOnboardingSubmission(
  data: OnboardingSubmissionData
): Promise<OnboardingSubmission> {
  const formTemplateId = data.form_template_id ?? data.template_id;

  if (!formTemplateId) {
    throw new Error("Missing onboarding form template identifier");
  }

  const url = `${apiConfig.baseUrl}/v1/onboarding/submissions`;
  const response = await apiFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      form_template_id: formTemplateId,
      form_data: data.form_data,
      status: data.status,
    }),
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
 * Update onboarding submission (legacy helper)
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
 * Upload file to onboarding submission (legacy helper)
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
