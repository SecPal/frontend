// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Android enrollment session API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml`.
 */

export const ANDROID_RELEASE_CHANNELS = [
  "managed_device",
  "direct_apk",
  "github_release",
  "obtainium",
] as const;

export type AndroidReleaseChannel = (typeof ANDROID_RELEASE_CHANNELS)[number];
export type AndroidEnrollmentStatus =
  | "pending"
  | "exchanged"
  | "revoked"
  | "expired";

export interface AndroidEnrollmentSession {
  id: string;
  device_label: string | null;
  status: AndroidEnrollmentStatus;
  update_channel: AndroidReleaseChannel;
  bootstrap_token_expires_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface ProvisioningQrPayload {
  [key: string]: unknown;
}

export interface CreateSessionData {
  session: AndroidEnrollmentSession;
  provisioning_qr_payload: ProvisioningQrPayload;
}

export type ApiEnvelope<T> = { data: T };
export type AndroidSessionListResponse = ApiEnvelope<
  AndroidEnrollmentSession[]
>;
export type AndroidCreateSessionResponse = ApiEnvelope<CreateSessionData>;
