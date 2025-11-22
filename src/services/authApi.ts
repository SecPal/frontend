// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";

interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

interface LoginResponse {
  token: string;
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
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password,
      device_name: credentials.device_name || "secpal-frontend",
    }),
  });

  if (!response.ok) {
    let error: ApiError | null = null;
    try {
      error = await response.json();
    } catch {
      // Fallback if response is not JSON (e.g., HTML error page)
      throw new AuthApiError("Login failed");
    }
    throw new AuthApiError(error.message || "Login failed", error.errors);
  }

  return response.json();
}

/**
 * Logout - revoke current token
 * @param token - The auth token to revoke
 * @throws {AuthApiError} If logout fails
 */
export async function logout(token: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
    throw new AuthApiError(error.message || "Logout failed", error.errors);
  }
}

/**
 * Logout all devices - revoke all tokens
 * @param token - The auth token
 * @throws {AuthApiError} If logout fails
 */
export async function logoutAll(token: string): Promise<void> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/logout-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
      error.message || "Logout all devices failed",
      error.errors
    );
  }
}
