// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Android provisioning API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml`.
 */

export type AndroidEnrollmentMode = "device_owner";

export type AndroidReleaseChannel =
  | "managed_device"
  | "direct_apk"
  | "github_release"
  | "obtainium";

export type AndroidEnrollmentSessionStatus =
  | "pending"
  | "exchanged"
  | "revoked"
  | "expired";

export interface AndroidProvisioningProfile {
  kiosk_mode_enabled: boolean;
  lock_task_enabled: boolean;
  allow_phone: boolean;
  allow_sms: boolean;
  prefer_gesture_navigation: boolean;
  allowed_packages: string[];
}

export interface AndroidEnrollmentSession {
  id: string;
  device_label: string | null;
  status: AndroidEnrollmentSessionStatus;
  enrollment_mode: AndroidEnrollmentMode;
  update_channel: AndroidReleaseChannel;
  release_metadata_url: string;
  provisioning_profile: AndroidProvisioningProfile;
  bootstrap_token_expires_at: string;
  bootstrap_token_last_eight: string | null;
  exchanged_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AndroidEnrollmentSessionListResponse {
  data: AndroidEnrollmentSession[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

export interface CreateAndroidEnrollmentSessionRequest {
  device_label?: string;
  enrollment_mode?: AndroidEnrollmentMode;
  update_channel: AndroidReleaseChannel;
  expires_in_minutes?: number;
  notes?: string;
  provisioning_profile: AndroidProvisioningProfile;
}

export interface CreateAndroidEnrollmentSessionResponse {
  session: AndroidEnrollmentSession;
  provisioning_qr_payload: string;
}

export interface RevokeAndroidEnrollmentSessionRequest {
  reason: string;
}
