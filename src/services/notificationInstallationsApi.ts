// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type {
  BrowserNotificationInstallationRequest,
  BrowserNotificationInstallationResponse,
  BrowserNotificationInstallationRevocationResponse,
  BrowserPushBootstrapData,
  BrowserPushBootstrapResponse,
} from "@/types/api";
import { buildApiUrl } from "../config";
import { apiFetch } from "./csrf";

interface NotificationApiErrorPayload {
  message?: string;
  code?: string;
  details?: Record<string, unknown>;
}

function hasJsonContentType(response: Response): boolean {
  if (
    !("headers" in response) ||
    !response.headers ||
    typeof response.headers.get !== "function"
  ) {
    return typeof response.json === "function";
  }

  const contentType = response.headers.get("Content-Type");

  return contentType?.toLowerCase().includes("application/json") ?? false;
}

async function parseJsonResponse<T>(
  response: Response,
  operation: string
): Promise<T> {
  if (!hasJsonContentType(response)) {
    throw new NotificationInstallationsApiError(
      `${operation}: expected application/json response from API`
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new NotificationInstallationsApiError(
      `${operation}: received malformed JSON from API`
    );
  }
}

async function parseJsonError(
  response: Response
): Promise<NotificationApiErrorPayload | null> {
  if (!hasJsonContentType(response)) {
    return null;
  }

  try {
    return (await response.json()) as NotificationApiErrorPayload;
  } catch {
    return null;
  }
}

export class NotificationInstallationsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "NotificationInstallationsApiError";
  }
}

async function createNotificationInstallationsApiError(
  response: Response,
  defaultMessage: string
): Promise<NotificationInstallationsApiError> {
  const error = await parseJsonError(response);

  if (!error) {
    return new NotificationInstallationsApiError(
      `${defaultMessage}: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  return new NotificationInstallationsApiError(
    error.message || defaultMessage,
    response.status,
    error.code,
    error.details
  );
}

export async function getBrowserPushBootstrapData(): Promise<BrowserPushBootstrapData | null> {
  const response = await apiFetch(
    buildApiUrl("/v1/bootstrap?client_platform=browser"),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await createNotificationInstallationsApiError(
      response,
      "Browser bootstrap fetch failed"
    );
  }

  const payload = await parseJsonResponse<BrowserPushBootstrapResponse>(
    response,
    "Browser bootstrap fetch failed"
  );

  return payload.data.features.notification_channels.web_push === true
    ? payload.data
    : null;
}

export async function upsertBrowserNotificationInstallation(
  installationId: string,
  payload: BrowserNotificationInstallationRequest
): Promise<BrowserNotificationInstallationResponse["data"]> {
  const response = await apiFetch(
    buildApiUrl(`/v1/me/notification-installations/${installationId}`),
    {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw await createNotificationInstallationsApiError(
      response,
      "Browser notification installation update failed"
    );
  }

  const result =
    await parseJsonResponse<BrowserNotificationInstallationResponse>(
      response,
      "Browser notification installation update failed"
    );

  return result.data;
}

export async function revokeBrowserNotificationInstallation(
  installationId: string
): Promise<BrowserNotificationInstallationRevocationResponse["data"] | null> {
  const response = await apiFetch(
    buildApiUrl(`/v1/me/notification-installations/${installationId}`),
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await createNotificationInstallationsApiError(
      response,
      "Browser notification installation revoke failed"
    );
  }

  const result =
    await parseJsonResponse<BrowserNotificationInstallationRevocationResponse>(
      response,
      "Browser notification installation revoke failed"
    );

  return result.data;
}
