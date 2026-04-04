// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Authentication and MFA API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml` and
 * aligned with the current backend/runtime behavior for frontend session flows.
 */

export type AuthenticatedUserId = number | string;

export interface AuthenticatedUser {
  id: AuthenticatedUserId;
  name: string;
  email: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
  hasOrganizationalScopes: boolean;
  hasCustomerAccess: boolean;
  hasSiteAccess: boolean;
}

export interface SessionLoginResponse {
  user: AuthenticatedUser;
}

export interface TokenLoginResponse {
  token: string;
  user: AuthenticatedUser;
}

export interface VerificationNotificationResponse {
  message: string;
}

export type MfaLoginPurpose = "login";
export type MfaLoginContext = "session" | "token";
export type MfaPrimaryMethod = "totp";
export type MfaVerificationMethod = "totp" | "recovery_code";

export interface MfaChallenge {
  id: string;
  purpose: MfaLoginPurpose;
  login_context: MfaLoginContext;
  primary_method: MfaPrimaryMethod;
  available_methods: MfaVerificationMethod[];
  expires_at: string;
}

export interface LoginMfaChallengeResponse {
  challenge: MfaChallenge;
}

export interface SessionAuthenticationResult {
  mode: "session";
  mfa_completed: true;
}

export interface TokenAuthenticationResult {
  mode: "token";
  mfa_completed: true;
}

export type CompletedLoginResponse =
  | {
    user: AuthenticatedUser;
    authentication: SessionAuthenticationResult;
  }
  | {
    token: string;
    user: AuthenticatedUser;
    authentication: TokenAuthenticationResult;
  };

export interface MfaStatus {
  enabled: boolean;
  method: "totp" | null;
  recovery_codes_remaining: number;
  recovery_codes_generated_at: string | null;
  enrolled_at: string | null;
}

export interface MfaStatusResponse {
  data: MfaStatus;
}

export interface TotpCodeRequest {
  code: string;
}

export interface MfaVerificationCodeRequest {
  method: MfaVerificationMethod;
  code: string;
}

export interface TotpEnrollmentPreparation {
  issuer: string;
  account_name: string;
  manual_entry_key: string;
  otpauth_uri: string;
  expires_at: string;
}

export interface MfaTotpEnrollmentResponse {
  data: TotpEnrollmentPreparation;
}

export interface MfaRecoveryCodeReveal {
  codes: string[];
  generated_at: string;
}

export interface MfaRecoveryCodeRevealPayload {
  status: MfaStatus;
  recovery_codes: MfaRecoveryCodeReveal;
}

export interface MfaRecoveryCodeRevealResponse {
  data: MfaRecoveryCodeRevealPayload;
}
