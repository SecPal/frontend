// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

// OpenAPI component type output for frontend API aliases.
// Source: contracts/docs/openapi.yaml

export interface components {
  schemas: {
    BootstrapClientPlatform: "android" | "browser";
    BootstrapVersion: "v1";
    NotificationChannel: "android_fcm" | "web_push";
    NotificationChannelFeatureFlags: {
      android_fcm: boolean;
      web_push: boolean;
    };
    AndroidFcmPublicRuntimeMetadata: {
      api_key: string;
      project_id: string;
      application_id: string;
      sender_id: string;
    };
    WebPushPublicRuntimeMetadata: {
      vapid_public_key: string;
    };
    AndroidFcmNotificationChannelRuntime: {
      channel: "android_fcm";
      metadata_revision: number;
      public_runtime_metadata: components["schemas"]["AndroidFcmPublicRuntimeMetadata"];
    };
    WebPushNotificationChannelRuntime: {
      channel: "web_push";
      metadata_revision: number;
      public_runtime_metadata: components["schemas"]["WebPushPublicRuntimeMetadata"];
    };
    NotificationChannelRuntimeMetadata: {
      android_fcm?: components["schemas"]["AndroidFcmNotificationChannelRuntime"];
      web_push?: components["schemas"]["WebPushNotificationChannelRuntime"];
    };
    BootstrapInstanceMetadata: {
      display_name: string;
    };
    BootstrapFeatureFlags: {
      password_login: boolean;
      passkey_login: boolean;
      managed_android_enrollment: boolean;
      notification_channels: components["schemas"]["NotificationChannelFeatureFlags"];
    };
    BootstrapCompatibility: {
      bootstrap_version: components["schemas"]["BootstrapVersion"];
      schema_version: number;
      minimum_supported_app_version: string;
      minimum_supported_app_build: number;
    };
    BootstrapConfiguration: {
      client_platform: components["schemas"]["BootstrapClientPlatform"];
      api_base_url: string;
      instance: components["schemas"]["BootstrapInstanceMetadata"];
      compatibility: components["schemas"]["BootstrapCompatibility"];
      features: components["schemas"]["BootstrapFeatureFlags"];
      notification_channels?: components["schemas"]["NotificationChannelRuntimeMetadata"];
    };
    BootstrapResponse: {
      data: components["schemas"]["BootstrapConfiguration"];
    };
  };
}
