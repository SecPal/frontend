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
    const error: ApiError = await response.json();
    throw new AuthApiError(error.message || "Login failed", error.errors);
  }

  return response.json();
}

/**
 * Logout - revoke current token
 * @param token - The auth token to revoke
 */
export async function logout(token: string): Promise<void> {
  await fetch(`${getApiBaseUrl()}/v1/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

/**
 * Logout all devices - revoke all tokens
 * @param token - The auth token
 */
export async function logoutAll(token: string): Promise<void> {
  await fetch(`${getApiBaseUrl()}/v1/auth/logout-all`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}
