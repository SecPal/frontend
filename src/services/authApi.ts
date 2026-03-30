// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { buildApiUrl } from "../config";
import { fetchCsrfToken, apiFetch } from "./csrf";

interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

interface LoginResponse {
  user: {
    id: number;
    name: string;
    email: string;
    roles?: string[];
    permissions?: string[];
    hasOrganizationalScopes?: boolean;
    hasCustomerAccess?: boolean;
    hasSiteAccess?: boolean;
  };
}

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
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

export class AuthApiError extends Error {
  constructor(
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

/**
 * Login with email and password
 * @throws {AuthApiError} If login fails
 */
export async function login(
  credentials: LoginCredentials
): Promise<LoginResponse> {
  // Fetch CSRF token before login
  await fetchCsrfToken();

  // Use SPA login endpoint (session-based, not token-based)
  const response = await apiFetch(buildApiUrl("/v1/auth/login"), {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
    }),
  });

  if (!response.ok) {
    const error = await parseJsonError(response);

    if (!error) {
      // Fallback if response is not JSON (e.g., HTML error page)
      throw new AuthApiError(
        `Login failed: ${response.status} ${response.statusText}`
      );
    }

    throw new AuthApiError(error?.message || "Login failed", error?.errors);
  }

  return parseJsonResponse<LoginResponse>(response, "Login failed");
}

/**
 * Logout - end current session using the canonical auth endpoint
 * @throws {AuthApiError} If logout fails
 */
export async function logout(): Promise<void> {
  const response = await apiFetch(buildApiUrl("/v1/auth/logout"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await parseJsonError(response);

    if (!error) {
      throw new AuthApiError("Logout failed");
    }

    throw new AuthApiError(error?.message || "Logout failed", error?.errors);
  }
}

/**
 * Logout all devices - revoke all tokens
 * @throws {AuthApiError} If logout fails
 */
export async function logoutAll(): Promise<void> {
  const response = await apiFetch(buildApiUrl("/v1/auth/logout-all"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const error = await parseJsonError(response);

    if (!error) {
      throw new AuthApiError("Logout all devices failed");
    }

    throw new AuthApiError(
      error?.message || "Logout all devices failed",
      error?.errors
    );
  }
}

/**
 * Fetch the currently authenticated user for bootstrap revalidation.
 * @throws {AuthApiError} If the session is invalid or the request fails
 */
export async function getCurrentUser(): Promise<LoginResponse["user"]> {
  let response: Response;
  try {
    response = await apiFetch(buildApiUrl("/v1/me"), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Current user fetch failed: ${error.message}`
        : "Current user fetch failed";
    throw new AuthApiError(message);
  }

  if (!response.ok) {
    const error = await parseJsonError(response);

    if (!error) {
      throw new AuthApiError(
        `Current user fetch failed: ${response.status} ${response.statusText}`
      );
    }

    throw new AuthApiError(
      error?.message || "Current user fetch failed",
      error?.errors
    );
  }

  return parseJsonResponse<LoginResponse["user"]>(
    response,
    "Current user fetch failed"
  );
}
