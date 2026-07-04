// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type {
  MfaRecoveryCodeRevealResponse,
  MfaStatusResponse,
  MfaTotpEnrollmentResponse,
  MfaVerificationCodeRequest,
  PasskeyDeletionResponse,
  PasskeyListResponse,
  PasskeyRegistrationChallengeResponse,
  PasskeyRegistrationResponse,
  PasskeyRegistrationVerificationRequest,
  TotpCodeRequest,
  VerificationNotificationResponse,
} from "@/types/api";
import { buildApiUrl } from "../config";
import { createAuthApiError, parseJsonResponse } from "./authApiShared";
import { apiFetch, fetchCsrfToken } from "./csrf";

export { AuthApiError } from "./AuthApiError";

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
