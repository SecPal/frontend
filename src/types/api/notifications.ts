// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Notification installation and browser bootstrap API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml` and
 * aligned with the authenticated browser Web Push lifecycle.
 */

export type NotificationChannel = "android_fcm" | "web_push";

export interface NotificationChannelFeatureFlags {
  android_fcm: boolean;
  web_push: boolean;
}

export interface BrowserBootstrapCompatibility {
  bootstrap_version: string;
  schema_version: number;
  minimum_supported_app_version?: string;
  minimum_supported_app_build?: number;
}

export interface BrowserWebPushRuntimeMetadata {
  channel: "web_push";
  metadata_revision: number;
  public_runtime_metadata: {
    vapid_public_key: string;
  };
}

export interface BrowserPushBootstrapData {
  client_platform: "browser" | string;
  compatibility: BrowserBootstrapCompatibility;
  features: {
    notification_channels: NotificationChannelFeatureFlags;
  };
  notification_channels?: {
    web_push?: BrowserWebPushRuntimeMetadata;
  };
}

export interface BrowserPushBootstrapResponse {
  data: BrowserPushBootstrapData;
}

export type NotificationInstallationLifecycleEvent =
  "registered" | "credential_rotated" | "client_updated";

export interface BrowserNotificationInstallationRequest {
  channel: "web_push";
  installation_name: string;
  lifecycle_event: NotificationInstallationLifecycleEvent;
  runtime: {
    bootstrap_version: string;
    schema_version: number;
    metadata_revision: number;
  };
  registration: {
    browser: {
      browser_name: string;
      browser_version?: string | null;
      service_worker_scope?: string | null;
    };
    subscription: {
      endpoint: string;
      expiration_time?: number | null;
      keys: {
        p256dh: string;
        auth: string;
      };
    };
  };
}

export interface BrowserNotificationInstallationSummary {
  installation_id: string;
  channel: "web_push";
  installation_name: string;
  credential_reference: string;
  last_lifecycle_event: NotificationInstallationLifecycleEvent;
  registration: {
    browser: {
      browser_name: string | null;
      browser_version: string | null;
      service_worker_scope: string | null;
    };
    subscription_endpoint_origin: string | null;
    subscription_expires_at: string | null;
  };
  runtime: {
    bootstrap_version: string;
    schema_version: number;
    metadata_revision: number;
  };
  created_at?: string;
  updated_at?: string;
}

export interface BrowserNotificationInstallationResponse {
  data: BrowserNotificationInstallationSummary;
}

export interface BrowserNotificationInstallationRevocationResponse {
  data: {
    installation_id: string;
    channel: "web_push";
    revoked_at: string;
  };
}
