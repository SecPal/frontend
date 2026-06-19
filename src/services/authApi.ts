// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  CompletedLoginResponse,
  LoginMfaChallengeResponse,
  MfaVerificationCodeRequest,
  PasskeyAuthenticationChallengeResponse,
  PasskeyAuthenticationVerificationRequest,
  SessionLoginResponse,
} from "@/types/api";
import { ApiBaseUrlConfigurationError, buildApiUrl } from "../config";
import { AuthApiError } from "./AuthApiError";
import { createAuthApiError, parseJsonResponse } from "./authApiShared";
import { fetchCsrfToken, apiFetch } from "./csrf";

interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

export type BrowserLoginResponse =
  | SessionLoginResponse
  | LoginMfaChallengeResponse;

export { AuthApiError } from "./AuthApiError";

/**
 * Login with email and password
 * @throws {AuthApiError} If login fails
 */
export async function login(
  credentials: LoginCredentials
): Promise<BrowserLoginResponse> {
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
    throw await createAuthApiError(response, "Login failed");
  }

  return parseJsonResponse<BrowserLoginResponse>(response, "Login failed");
}

export async function verifyMfaChallenge(
  challengeId: string,
  payload: MfaVerificationCodeRequest
): Promise<CompletedLoginResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(
    buildApiUrl(`/v1/auth/mfa-challenges/${challengeId}/verify`),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw await createAuthApiError(response, "MFA verification failed");
  }

  return parseJsonResponse<CompletedLoginResponse>(
    response,
    "MFA verification failed"
  );
}

export async function startPasskeyAuthenticationChallenge(): Promise<PasskeyAuthenticationChallengeResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(buildApiUrl("/v1/auth/passkeys/challenges"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await createAuthApiError(response, "Passkey challenge start failed");
  }

  return parseJsonResponse<PasskeyAuthenticationChallengeResponse>(
    response,
    "Passkey challenge start failed"
  );
}

export async function verifyPasskeyAuthenticationChallenge(
  challengeId: string,
  payload: PasskeyAuthenticationVerificationRequest
): Promise<CompletedLoginResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(
    buildApiUrl(`/v1/auth/passkeys/challenges/${challengeId}/verify`),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    throw await createAuthApiError(response, "Passkey verification failed");
  }

  return parseJsonResponse<CompletedLoginResponse>(
    response,
    "Passkey verification failed"
  );
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
    throw await createAuthApiError(response, "Logout failed", "Logout failed");
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
    throw await createAuthApiError(
      response,
      "Logout all devices failed",
      "Logout all devices failed"
    );
  }
}

/**
 * Fetch the currently authenticated user for bootstrap revalidation.
 * @throws {AuthApiError} If the session is invalid or the request fails
 */
export async function getCurrentUser(): Promise<SessionLoginResponse["user"]> {
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
    if (error instanceof ApiBaseUrlConfigurationError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? `Current user fetch failed: ${error.message}`
        : "Current user fetch failed";
    throw new AuthApiError(message, undefined, undefined, "NETWORK_ERROR");
  }

  if (!response.ok) {
    throw await createAuthApiError(response, "Current user fetch failed");
  }

  return parseJsonResponse<SessionLoginResponse["user"]>(
    response,
    "Current user fetch failed"
  );
}
