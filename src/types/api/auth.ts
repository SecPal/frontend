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
  method?: "passkey";
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

export type PasskeyTransport =
  | "ble"
  | "hybrid"
  | "internal"
  | "nfc"
  | "usb"
  | (string & {});

export interface PasskeyCredentialSummary {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  transports: PasskeyTransport[];
}

export interface PasskeyListResponse {
  data: PasskeyCredentialSummary[];
}

export interface PasskeyCredentialParameter {
  type: "public-key";
  alg: number;
}

export interface PasskeyAuthenticatorSelection {
  authenticator_attachment?: "cross-platform" | "platform";
  resident_key?: "discouraged" | "preferred" | "required";
  require_resident_key?: boolean;
  user_verification?: "discouraged" | "preferred" | "required";
}

export interface PasskeyRegistrationPublicKeyOptions {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; display_name: string };
  pub_key_cred_params: PasskeyCredentialParameter[];
  timeout?: number;
  exclude_credentials?: PasskeyCredentialDescriptor[];
  authenticator_selection?: PasskeyAuthenticatorSelection;
  attestation?: "direct" | "enterprise" | "indirect" | "none" | (string & {});
}

export interface PasskeyRegistrationChallengeResponse {
  data: {
    challenge_id: string;
    public_key: PasskeyRegistrationPublicKeyOptions;
    expires_at?: string;
  };
}

export interface PasskeyCredentialDescriptor {
  type: "public-key";
  id: string;
  transports?: PasskeyTransport[];
}

export interface PasskeyAuthenticationPublicKeyOptions {
  challenge: string;
  rp_id: string;
  timeout?: number;
  user_verification?: "discouraged" | "preferred" | "required";
  allow_credentials?: PasskeyCredentialDescriptor[];
}

export interface PasskeyAuthenticationChallengeResponse {
  data: {
    challenge_id: string;
    public_key: PasskeyAuthenticationPublicKeyOptions;
    mediation: "conditional" | "optional" | "required" | "silent" | string;
    expires_at: string;
  };
}

export interface PasskeyAssertionResponsePayload {
  client_data_json: string;
  authenticator_data: string;
  signature: string;
  user_handle?: string | null;
}

export interface PasskeyAuthenticationCredential {
  id: string;
  raw_id: string;
  type: "public-key";
  response: PasskeyAssertionResponsePayload;
  client_extension_results?: Record<string, unknown>;
}

export interface PasskeyAuthenticationVerificationRequest {
  credential: PasskeyAuthenticationCredential;
}

export interface PasskeyAttestationResponsePayload {
  client_data_json: string;
  attestation_object: string;
  transports?: PasskeyTransport[];
}

export interface PasskeyRegistrationCredential {
  id: string;
  raw_id: string;
  type: "public-key";
  response: PasskeyAttestationResponsePayload;
  client_extension_results?: Record<string, unknown>;
}

export interface PasskeyRegistrationVerificationRequest {
  credential: PasskeyRegistrationCredential;
  label?: string;
}

export interface PasskeyRegistrationResponse {
  data: {
    credential: PasskeyCredentialSummary;
    total_passkeys: number;
  };
}
