// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";
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
  };
}

interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
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
  const response = await apiFetch(`${getApiBaseUrl()}/v1/auth/login`, {
    method: "POST",
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
    let error: ApiError | null = null;
    try {
      error = await response.json();
    } catch {
      // Fallback if response is not JSON (e.g., HTML error page)
      throw new AuthApiError(
        `Login failed: ${response.status} ${response.statusText}`
      );
    }
    throw new AuthApiError(error?.message || "Login failed", error?.errors);
  }

  return response.json();
}

/**
 * Logout - end current session (for SPA cookie auth)
 * @throws {AuthApiError} If logout fails
 */
export async function logout(): Promise<void> {
  const response = await apiFetch(`${getApiBaseUrl()}/v1/auth/session/logout`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let error: ApiError | null = null;
    try {
      error = await response.json();
    } catch {
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
  const response = await apiFetch(`${getApiBaseUrl()}/v1/auth/logout-all`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    let error: ApiError | null = null;
    try {
      error = await response.json();
    } catch {
      throw new AuthApiError("Logout all devices failed");
    }
    throw new AuthApiError(
      error?.message || "Logout all devices failed",
      error?.errors
    );
  }
}
