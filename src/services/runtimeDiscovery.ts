// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type {
  BootstrapConfiguration,
  BootstrapFeatureFlags,
  BootstrapResponse,
  NotificationChannelRuntimeMetadata,
} from "@/types/api";
import type { SecPalRuntimeInfo } from "../native";

const CURRENT_BOOTSTRAP_VERSION = "v1";
const CURRENT_BOOTSTRAP_SCHEMA_VERSION = 3;

export type RuntimeDiscoveryErrorCode =
  | "INVALID_INSTANCE_URL"
  | "RUNTIME_INFO_UNAVAILABLE"
  | "BOOTSTRAP_UNAVAILABLE"
  | "BOOTSTRAP_STATE_INVALID"
  | "BOOTSTRAP_INCOMPATIBLE"
  | "UNSUPPORTED_CLIENT_VERSION";

export class RuntimeDiscoveryError extends Error {
  readonly code: RuntimeDiscoveryErrorCode;

  constructor(code: RuntimeDiscoveryErrorCode, message: string) {
    super(message);
    this.name = "RuntimeDiscoveryError";
    this.code = code;
  }
}

export interface DiscoverAndroidRuntimeBootstrapOptions {
  readonly instanceUrl: string;
  readonly locale: string;
  readonly runtimeInfo: SecPalRuntimeInfo;
  readonly fetchBootstrap?: typeof fetch;
}

function normalizeInstanceOrigin(instanceUrl: string): string {
  let url: URL;

  try {
    url = new URL(instanceUrl.trim());
  } catch {
    throw new RuntimeDiscoveryError(
      "INVALID_INSTANCE_URL",
      "Enter a valid secure HTTPS instance URL."
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    pathname !== "" ||
    url.search ||
    url.hash
  ) {
    throw new RuntimeDiscoveryError(
      "INVALID_INSTANCE_URL",
      "Enter a valid secure HTTPS instance URL."
    );
  }

  return url.origin;
}

function buildBootstrapRequest(
  origin: string,
  runtimeInfo: SecPalRuntimeInfo,
  locale: string
): Request {
  if (
    runtimeInfo.clientPlatform !== "android" ||
    runtimeInfo.appVersion.trim().length === 0 ||
    !Number.isInteger(runtimeInfo.appBuild) ||
    runtimeInfo.appBuild <= 0
  ) {
    throw new RuntimeDiscoveryError(
      "RUNTIME_INFO_UNAVAILABLE",
      "Android runtime information is unavailable."
    );
  }

  const url = new URL("/v1/bootstrap", origin);
  url.searchParams.set("client_platform", runtimeInfo.clientPlatform);
  url.searchParams.set("app_version", runtimeInfo.appVersion);
  url.searchParams.set("app_build", String(runtimeInfo.appBuild));

  return new Request(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Language": locale,
    },
  });
}

async function parseBootstrapJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function normalizeApiBaseUrl(value: unknown): string {
  if (!isNonEmptyString(value)) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (pathname !== "" && pathname !== "/v1") ||
    url.search ||
    url.hash
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  return value;
}

function validateFeatureFlags(value: unknown): BootstrapFeatureFlags {
  if (!isRecord(value)) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  const notificationChannels = value.notification_channels;

  if (
    !isBoolean(value.password_login) ||
    !isBoolean(value.passkey_login) ||
    !isBoolean(value.managed_android_enrollment) ||
    !isRecord(notificationChannels) ||
    !isBoolean(notificationChannels.android_fcm) ||
    !isBoolean(notificationChannels.web_push)
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  return {
    password_login: value.password_login,
    passkey_login: value.passkey_login,
    managed_android_enrollment: value.managed_android_enrollment,
    notification_channels: {
      android_fcm: notificationChannels.android_fcm,
      web_push: notificationChannels.web_push,
    },
  };
}

function validateNotificationChannels(
  value: unknown,
  features: BootstrapFeatureFlags
): NotificationChannelRuntimeMetadata | undefined {
  if (!features.notification_channels.android_fcm) {
    return undefined;
  }

  if (!isRecord(value) || !isRecord(value.android_fcm)) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  const androidFcm = value.android_fcm;
  const publicRuntimeMetadata = androidFcm.public_runtime_metadata;

  if (
    androidFcm.channel !== "android_fcm" ||
    !Number.isInteger(androidFcm.metadata_revision) ||
    Number(androidFcm.metadata_revision) <= 0 ||
    !isRecord(publicRuntimeMetadata) ||
    !isNonEmptyString(publicRuntimeMetadata.api_key) ||
    !isNonEmptyString(publicRuntimeMetadata.project_id) ||
    !isNonEmptyString(publicRuntimeMetadata.application_id) ||
    !isNonEmptyString(publicRuntimeMetadata.sender_id)
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  return value as NotificationChannelRuntimeMetadata;
}

function validateBootstrapPayload(
  payload: unknown,
  runtimeInfo: SecPalRuntimeInfo
): BootstrapConfiguration {
  const data = isRecord(payload) ? payload.data : null;

  if (!isRecord(data)) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  if (data.client_platform !== "android") {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_INCOMPATIBLE",
      "This instance is not compatible with Android discovery."
    );
  }

  const instance = data.instance;
  const compatibility = data.compatibility;

  if (
    !isRecord(instance) ||
    !isNonEmptyString(instance.display_name) ||
    !isRecord(compatibility)
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  const minimumSupportedAppBuild = Number(
    compatibility.minimum_supported_app_build
  );
  const schemaVersion = Number(compatibility.schema_version);

  if (
    compatibility.bootstrap_version !== CURRENT_BOOTSTRAP_VERSION ||
    schemaVersion !== CURRENT_BOOTSTRAP_SCHEMA_VERSION
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_INCOMPATIBLE",
      "This instance must be verified by an administrator before it can be used."
    );
  }

  if (
    !isNonEmptyString(compatibility.minimum_supported_app_version) ||
    !Number.isInteger(minimumSupportedAppBuild) ||
    minimumSupportedAppBuild <= 0
  ) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  if (runtimeInfo.appBuild < minimumSupportedAppBuild) {
    throw new RuntimeDiscoveryError(
      "UNSUPPORTED_CLIENT_VERSION",
      "Update the Android app before using this instance."
    );
  }

  const features = validateFeatureFlags(data.features);
  const notificationChannels = validateNotificationChannels(
    data.notification_channels,
    features
  );

  return {
    client_platform: "android",
    api_base_url: normalizeApiBaseUrl(data.api_base_url),
    instance: {
      display_name: instance.display_name.trim(),
    },
    compatibility: {
      bootstrap_version: CURRENT_BOOTSTRAP_VERSION,
      schema_version: schemaVersion,
      minimum_supported_app_version:
        compatibility.minimum_supported_app_version.trim(),
      minimum_supported_app_build: minimumSupportedAppBuild,
    },
    features,
    notification_channels: notificationChannels,
  };
}

export async function discoverAndroidRuntimeBootstrap({
  instanceUrl,
  locale,
  runtimeInfo,
  fetchBootstrap = fetch,
}: DiscoverAndroidRuntimeBootstrapOptions): Promise<BootstrapConfiguration> {
  const origin = normalizeInstanceOrigin(instanceUrl);
  const request = buildBootstrapRequest(origin, runtimeInfo, locale);

  let response: Response;

  try {
    response = await fetchBootstrap(request);
  } catch {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_UNAVAILABLE",
      "Could not reach that instance. Check the URL with your supervisor."
    );
  }

  const payload = (await parseBootstrapJson(response)) as BootstrapResponse;

  if (response.status === 426) {
    throw new RuntimeDiscoveryError(
      "UNSUPPORTED_CLIENT_VERSION",
      "Update the Android app before using this instance."
    );
  }

  if (response.status === 409) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_STATE_INVALID",
      "The bootstrap response is incomplete."
    );
  }

  if (!response.ok) {
    throw new RuntimeDiscoveryError(
      "BOOTSTRAP_UNAVAILABLE",
      "Could not reach that instance. Check the URL with your supervisor."
    );
  }

  return validateBootstrapPayload(payload, runtimeInfo);
}
