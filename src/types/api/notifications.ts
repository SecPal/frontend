// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type {
  BootstrapConfiguration,
  BootstrapCompatibility,
  BootstrapResponse,
  WebPushNotificationChannelRuntime,
} from "./bootstrap";

/**
 * Notification installation API types.
 *
 * Derived from the shared API contract in `contracts/docs/openapi.yaml` and
 * aligned with the authenticated notification installation lifecycle.
 */

export type {
  NotificationChannel,
  NotificationChannelFeatureFlags,
} from "./bootstrap";

export type BrowserBootstrapCompatibility = BootstrapCompatibility;
export type BrowserWebPushRuntimeMetadata = WebPushNotificationChannelRuntime;
export type BrowserPushBootstrapData = BootstrapConfiguration & {
  client_platform: "browser";
};
export type BrowserPushBootstrapResponse = BootstrapResponse & {
  data: BrowserPushBootstrapData;
};

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
