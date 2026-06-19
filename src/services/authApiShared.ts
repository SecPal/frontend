// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AuthApiError } from "./AuthApiError";

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
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

export async function parseJsonResponse<T>(
  response: Response,
  operation: string
): Promise<T> {
  if (!hasJsonContentType(response)) {
    throw new AuthApiError(
      `${operation}: expected application/json response from API`
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new AuthApiError(`${operation}: received malformed JSON from API`);
  }
}

async function parseJsonError(response: Response): Promise<ApiError | null> {
  if (!hasJsonContentType(response)) {
    return null;
  }

  try {
    return (await response.json()) as ApiError;
  } catch {
    return null;
  }
}

function parseRetryAfterSeconds(response: Response): number | undefined {
  if (
    !("headers" in response) ||
    !response.headers ||
    typeof response.headers.get !== "function"
  ) {
    return undefined;
  }

  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : Number.NaN;

  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
    ? retryAfterSeconds
    : undefined;
}

export async function createAuthApiError(
  response: Response,
  defaultMessage: string,
  nonJsonMessage = `${defaultMessage}: ${response.status} ${response.statusText}`
): Promise<AuthApiError> {
  const error = await parseJsonError(response);
  const retryAfterSeconds = parseRetryAfterSeconds(response);

  if (!error) {
    return new AuthApiError(
      nonJsonMessage,
      undefined,
      response.status,
      undefined,
      retryAfterSeconds
    );
  }

  return new AuthApiError(
    error.message || defaultMessage,
    error.errors,
    response.status,
    error.code,
    retryAfterSeconds
  );
}
