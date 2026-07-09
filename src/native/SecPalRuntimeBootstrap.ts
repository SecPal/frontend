// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { NativeRuntimeBootstrap } from "../types/api/bootstrap";

export interface SecPalRuntimeInfo {
  readonly clientPlatform: "android";
  readonly appVersion: string;
  readonly appBuild: number;
}

export interface SecPalAndroidPushRuntimeBootstrap {
  readonly provider: "fcm";
  readonly metadataRevision: number;
  readonly publicClientMetadata: {
    readonly apiKey: string;
    readonly projectId: string;
    readonly applicationId: string;
    readonly senderId: string;
  };
}

export interface SecPalAppliedRuntimeBootstrap {
  readonly instanceDisplayName: string;
  readonly apiOrigin: string;
  readonly rawApiBaseUrl: string;
  readonly minimumSupportedAppVersion: string;
  readonly minimumSupportedAppBuild: number;
  readonly androidPush?: SecPalAndroidPushRuntimeBootstrap | null;
  readonly features?: {
    readonly passwordLoginEnabled: boolean;
    readonly passkeyLoginEnabled: boolean;
    readonly managedAndroidEnrollment: boolean;
  };
}

export interface SecPalRuntimeBootstrapState {
  readonly configured: boolean;
  readonly bootstrap?: SecPalAppliedRuntimeBootstrap;
}

export interface SecPalRuntimeBootstrapFacade {
  getRuntimeInfo(): Promise<SecPalRuntimeInfo | null>;
  getRuntimeBootstrap(): Promise<SecPalRuntimeBootstrapState | null>;
  setRuntimeBootstrap(bootstrap: NativeRuntimeBootstrap): Promise<void>;
  clearRuntimeBootstrap(): Promise<void>;
}

interface SecPalRuntimeBootstrapBridge {
  getRuntimeInfo?(): Promise<SecPalRuntimeInfo>;
  getRuntimeBootstrap?(): Promise<SecPalRuntimeBootstrapState>;
  setRuntimeBootstrap?(
    bootstrap: SecPalAppliedRuntimeBootstrap
  ): Promise<unknown>;
  clearRuntimeBootstrap?(): Promise<void>;
}

function getRuntimeBootstrapBridge(): SecPalRuntimeBootstrapBridge | null {
  const candidate = (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: unknown;
    }
  ).SecPalNativeAuthBridge;

  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }

  return candidate as SecPalRuntimeBootstrapBridge;
}

function resolveApiOrigin(rawApiBaseUrl: string): string {
  const url = new URL(rawApiBaseUrl);

  return url.origin;
}

function toAppliedRuntimeBootstrap(
  bootstrap: NativeRuntimeBootstrap
): SecPalAppliedRuntimeBootstrap {
  const androidFcm = bootstrap.notification_channels?.android_fcm;

  return {
    instanceDisplayName: bootstrap.instance.display_name,
    apiOrigin: resolveApiOrigin(bootstrap.api_base_url),
    rawApiBaseUrl: bootstrap.api_base_url,
    minimumSupportedAppVersion:
      bootstrap.compatibility.minimum_supported_app_version,
    minimumSupportedAppBuild:
      bootstrap.compatibility.minimum_supported_app_build,
    androidPush: androidFcm
      ? {
          provider: "fcm",
          metadataRevision: androidFcm.metadata_revision,
          publicClientMetadata: {
            apiKey: androidFcm.public_runtime_metadata.api_key,
            projectId: androidFcm.public_runtime_metadata.project_id,
            applicationId: androidFcm.public_runtime_metadata.application_id,
            senderId: androidFcm.public_runtime_metadata.sender_id,
          },
        }
      : null,
    features: {
      passwordLoginEnabled: bootstrap.features.password_login,
      passkeyLoginEnabled: bootstrap.features.passkey_login,
      managedAndroidEnrollment: bootstrap.features.managed_android_enrollment,
    },
  };
}

export const SecPalRuntimeBootstrap: SecPalRuntimeBootstrapFacade = {
  async getRuntimeInfo(): Promise<SecPalRuntimeInfo | null> {
    const bridge = getRuntimeBootstrapBridge();

    if (typeof bridge?.getRuntimeInfo !== "function") {
      return null;
    }

    return bridge.getRuntimeInfo();
  },
  async getRuntimeBootstrap(): Promise<SecPalRuntimeBootstrapState | null> {
    const bridge = getRuntimeBootstrapBridge();

    if (typeof bridge?.getRuntimeBootstrap !== "function") {
      return null;
    }

    return bridge.getRuntimeBootstrap();
  },
  async setRuntimeBootstrap(bootstrap: NativeRuntimeBootstrap): Promise<void> {
    const bridge = getRuntimeBootstrapBridge();

    if (typeof bridge?.setRuntimeBootstrap !== "function") {
      return undefined;
    }

    await bridge.setRuntimeBootstrap(toAppliedRuntimeBootstrap(bootstrap));
  },
  async clearRuntimeBootstrap(): Promise<void> {
    const bridge = getRuntimeBootstrapBridge();

    if (typeof bridge?.clearRuntimeBootstrap !== "function") {
      return undefined;
    }

    await bridge.clearRuntimeBootstrap();
  },
};
