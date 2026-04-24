// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  CompletedLoginResponse,
  LoginMfaChallengeResponse,
  MfaRecoveryCodeRevealResponse,
  MfaStatusResponse,
  MfaTotpEnrollmentResponse,
  PasskeyAuthenticationChallengeRequest,
  MfaVerificationCodeRequest,
  PasskeyDeletionResponse,
  PasskeyAuthenticationChallengeResponse,
  PasskeyAuthenticationVerificationRequest,
  PasskeyListResponse,
  PasskeyRegistrationChallengeResponse,
  PasskeyRegistrationResponse,
  PasskeyRegistrationVerificationRequest,
  SessionLoginResponse,
  TotpCodeRequest,
  VerificationNotificationResponse,
} from "@/types/api";
import { buildApiUrl } from "../config";
import { fetchCsrfToken, apiFetch } from "./csrf";

interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

export type BrowserLoginResponse =
  | SessionLoginResponse
  | LoginMfaChallengeResponse;

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

  return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
    ? retryAfterSeconds
    : undefined;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public errors?: Record<string, string[]>,
    public status?: number,
    public code?: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

async function createAuthApiError(
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

export async function startPasskeyAuthenticationChallenge(
  payload?: PasskeyAuthenticationChallengeRequest
): Promise<PasskeyAuthenticationChallengeResponse> {
  await fetchCsrfToken();

  const hasPayload = typeof payload?.email === "string" && payload.email !== "";

  const response = await apiFetch(buildApiUrl("/v1/auth/passkeys/challenges"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(hasPayload ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasPayload ? { body: JSON.stringify(payload) } : {}),
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
    const message =
      error instanceof Error
        ? `Current user fetch failed: ${error.message}`
        : "Current user fetch failed";
    throw new AuthApiError(message);
  }

  if (!response.ok) {
    throw await createAuthApiError(response, "Current user fetch failed");
  }

  return parseJsonResponse<SessionLoginResponse["user"]>(
    response,
    "Current user fetch failed"
  );
}

export async function sendVerificationNotification(): Promise<VerificationNotificationResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(
    buildApiUrl("/v1/auth/email/verification-notification"),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await createAuthApiError(
      response,
      "Verification email request failed"
    );
  }

  return parseJsonResponse<VerificationNotificationResponse>(
    response,
    "Verification email request failed"
  );
}

export async function getMfaStatus(): Promise<MfaStatusResponse> {
  const response = await apiFetch(buildApiUrl("/v1/me/mfa"), {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await createAuthApiError(response, "MFA status fetch failed");
  }

  return parseJsonResponse<MfaStatusResponse>(
    response,
    "MFA status fetch failed"
  );
}

export async function getPasskeys(): Promise<PasskeyListResponse> {
  const response = await apiFetch(buildApiUrl("/v1/me/passkeys"), {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await createAuthApiError(response, "Passkey list fetch failed");
  }

  return parseJsonResponse<PasskeyListResponse>(
    response,
    "Passkey list fetch failed"
  );
}

export async function startPasskeyRegistrationChallenge(): Promise<PasskeyRegistrationChallengeResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(
    buildApiUrl("/v1/me/passkeys/challenges/registration"),
    {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await createAuthApiError(
      response,
      "Passkey registration challenge start failed"
    );
  }

  return parseJsonResponse<PasskeyRegistrationChallengeResponse>(
    response,
    "Passkey registration challenge start failed"
  );
}

export async function verifyPasskeyRegistrationChallenge(
  challengeId: string,
  payload: PasskeyRegistrationVerificationRequest
): Promise<PasskeyRegistrationResponse> {
  await fetchCsrfToken();

  const response = await apiFetch(
    buildApiUrl(
      `/v1/me/passkeys/challenges/registration/${challengeId}/verify`
    ),
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
    throw await createAuthApiError(response, "Passkey registration failed");
  }

  return parseJsonResponse<PasskeyRegistrationResponse>(
    response,
    "Passkey registration failed"
  );
}

export async function deletePasskey(
  credentialId: string
): Promise<PasskeyDeletionResponse> {
  const response = await apiFetch(
    buildApiUrl(`/v1/me/passkeys/${credentialId}`),
    {
      method: "DELETE",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw await createAuthApiError(response, "Passkey deletion failed");
  }

  return parseJsonResponse<PasskeyDeletionResponse>(
    response,
    "Passkey deletion failed"
  );
}

export async function startTotpEnrollment(): Promise<MfaTotpEnrollmentResponse> {
  const response = await apiFetch(buildApiUrl("/v1/me/mfa/totp/enrollment"), {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await createAuthApiError(response, "TOTP enrollment start failed");
  }

  return parseJsonResponse<MfaTotpEnrollmentResponse>(
    response,
    "TOTP enrollment start failed"
  );
}

export async function confirmTotpEnrollment(
  payload: TotpCodeRequest
): Promise<MfaRecoveryCodeRevealResponse> {
  const response = await apiFetch(
    buildApiUrl("/v1/me/mfa/totp/enrollment/confirm"),
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
    throw await createAuthApiError(
      response,
      "TOTP enrollment confirmation failed"
    );
  }

  return parseJsonResponse<MfaRecoveryCodeRevealResponse>(
    response,
    "TOTP enrollment confirmation failed"
  );
}

export async function regenerateRecoveryCodes(
  payload: MfaVerificationCodeRequest
): Promise<MfaRecoveryCodeRevealResponse> {
  const response = await apiFetch(
    buildApiUrl("/v1/me/mfa/recovery-codes/regenerate"),
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
    throw await createAuthApiError(
      response,
      "Recovery code regeneration failed"
    );
  }

  return parseJsonResponse<MfaRecoveryCodeRevealResponse>(
    response,
    "Recovery code regeneration failed"
  );
}

export async function disableMfa(
  payload: MfaVerificationCodeRequest
): Promise<MfaStatusResponse> {
  const response = await apiFetch(buildApiUrl("/v1/me/mfa"), {
    method: "DELETE",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw await createAuthApiError(response, "MFA disable failed");
  }

  return parseJsonResponse<MfaStatusResponse>(response, "MFA disable failed");
}
