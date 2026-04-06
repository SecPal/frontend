// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  AndroidEnrollmentSession,
  AndroidEnrollmentSessionListResponse,
  CreateAndroidEnrollmentSessionRequest,
  CreateAndroidEnrollmentSessionResponse,
  RevokeAndroidEnrollmentSessionRequest,
} from "@/types/api";
import { apiConfig } from "../config";
import { apiFetch } from "./csrf";
import { ApiError } from "./ApiError";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorPayload {
  message?: string;
  errors?: Record<string, string[]>;
}

async function parseError(response: Response): Promise<ApiError> {
  const error = (await response
    .json()
    .catch(() => ({ message: response.statusText }))) as ApiErrorPayload;

  return new ApiError(
    error.message ||
      response.statusText ||
      "Android provisioning request failed",
    response.status,
    error.errors,
    response
  );
}

export async function listAndroidEnrollmentSessions(params?: {
  page?: number;
  per_page?: number;
  status?: AndroidEnrollmentSession["status"];
}): Promise<AndroidEnrollmentSessionListResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) {
    searchParams.append("page", params.page.toString());
  }

  if (params?.per_page) {
    searchParams.append("per_page", params.per_page.toString());
  }

  if (params?.status) {
    searchParams.append("status", params.status);
  }

  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as AndroidEnrollmentSessionListResponse;
}

export async function createAndroidEnrollmentSession(
  payload: CreateAndroidEnrollmentSessionRequest
): Promise<CreateAndroidEnrollmentSessionResponse> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const data =
    (await response.json()) as ApiEnvelope<CreateAndroidEnrollmentSessionResponse>;
  return data.data;
}

export async function getAndroidEnrollmentSession(
  sessionId: string
): Promise<AndroidEnrollmentSession> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions/${sessionId}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as ApiEnvelope<AndroidEnrollmentSession>;
  return data.data;
}

export async function revokeAndroidEnrollmentSession(
  sessionId: string,
  payload: RevokeAndroidEnrollmentSessionRequest
): Promise<AndroidEnrollmentSession> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/admin/android-enrollment-sessions/${sessionId}/revoke`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw await parseError(response);
  }

  const data = (await response.json()) as ApiEnvelope<AndroidEnrollmentSession>;
  return data.data;
}
