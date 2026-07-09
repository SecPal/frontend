// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Public runtime bootstrap API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml` and
 * aligned with `GET /v1/bootstrap` for browser and Android runtime discovery.
 */

export type BootstrapClientPlatform = "android" | "browser";
export type BootstrapVersion = "v1";
export type NotificationChannel = "android_fcm" | "web_push";

export interface NotificationChannelFeatureFlags {
  android_fcm: boolean;
  web_push: boolean;
}

export interface AndroidFcmPublicRuntimeMetadata {
  api_key: string;
  project_id: string;
  application_id: string;
  sender_id: string;
}

export interface WebPushPublicRuntimeMetadata {
  vapid_public_key: string;
}

export interface AndroidFcmNotificationChannelRuntime {
  channel: "android_fcm";
  metadata_revision: number;
  public_runtime_metadata: AndroidFcmPublicRuntimeMetadata;
}

export interface WebPushNotificationChannelRuntime {
  channel: "web_push";
  metadata_revision: number;
  public_runtime_metadata: WebPushPublicRuntimeMetadata;
}

export interface NotificationChannelRuntimeMetadata {
  android_fcm?: AndroidFcmNotificationChannelRuntime;
  web_push?: WebPushNotificationChannelRuntime;
}

export interface BootstrapInstanceMetadata {
  display_name: string;
}

export interface BootstrapFeatureFlags {
  password_login: boolean;
  passkey_login: boolean;
  managed_android_enrollment: boolean;
  notification_channels: NotificationChannelFeatureFlags;
}

export interface BootstrapCompatibility {
  bootstrap_version: BootstrapVersion;
  schema_version: number;
  minimum_supported_app_version: string;
  minimum_supported_app_build: number;
}

export interface BootstrapLegalMetadata {
  license: {
    spdx_id: string;
    name: string;
    url: string;
    base_license_url: string;
  };
  source_url: string;
}

export interface BootstrapConfiguration {
  client_platform: BootstrapClientPlatform;
  api_base_url: string;
  instance: BootstrapInstanceMetadata;
  compatibility: BootstrapCompatibility;
  legal?: BootstrapLegalMetadata;
  features: BootstrapFeatureFlags;
  notification_channels?: NotificationChannelRuntimeMetadata;
}

export interface BootstrapResponse {
  data: BootstrapConfiguration;
}

export type NativeRuntimeBootstrap = Omit<
  BootstrapConfiguration,
  "client_platform" | "legal"
>;
