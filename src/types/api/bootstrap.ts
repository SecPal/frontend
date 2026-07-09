// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { components } from "./openapi.generated";

type Schemas = components["schemas"];

export type BootstrapClientPlatform = Schemas["BootstrapClientPlatform"];
export type BootstrapVersion = Schemas["BootstrapVersion"];
export type NotificationChannel = Schemas["NotificationChannel"];
export type NotificationChannelFeatureFlags =
  Schemas["NotificationChannelFeatureFlags"];
export type AndroidFcmPublicRuntimeMetadata =
  Schemas["AndroidFcmPublicRuntimeMetadata"];
export type WebPushPublicRuntimeMetadata =
  Schemas["WebPushPublicRuntimeMetadata"];
export type AndroidFcmNotificationChannelRuntime =
  Schemas["AndroidFcmNotificationChannelRuntime"];
export type WebPushNotificationChannelRuntime =
  Schemas["WebPushNotificationChannelRuntime"];
export type NotificationChannelRuntimeMetadata =
  Schemas["NotificationChannelRuntimeMetadata"];
export type BootstrapInstanceMetadata = Schemas["BootstrapInstanceMetadata"];
export type BootstrapFeatureFlags = Schemas["BootstrapFeatureFlags"];
export type BootstrapCompatibility = Schemas["BootstrapCompatibility"];
export interface BootstrapLegalMetadata {
  license: {
    spdx_id: string;
    name: string;
    url: string;
    base_license_url: string;
  };
  source_url: string;
}
export type BootstrapConfiguration = Schemas["BootstrapConfiguration"] & {
  legal?: BootstrapLegalMetadata;
};
export type BootstrapResponse = Omit<Schemas["BootstrapResponse"], "data"> & {
  data: BootstrapConfiguration;
};

export type NativeRuntimeBootstrap = Omit<
  BootstrapConfiguration,
  "client_platform"
>;
