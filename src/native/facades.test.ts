// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

import * as nativeFacades from "./index";

const nativeGlobal = globalThis as typeof globalThis & {
  SecPalNativeAuthBridge?: unknown;
};

afterEach(() => {
  delete nativeGlobal.SecPalNativeAuthBridge;
});

describe("native facade surface", () => {
  it("exposes explicit domain facades instead of a generic native command bridge", () => {
    expect(nativeFacades).toHaveProperty("SecPalDeviceState");
    expect(nativeFacades).toHaveProperty("SecPalEnterprise");
    expect(nativeFacades).toHaveProperty("SecPalPush");
    expect(nativeFacades).toHaveProperty("SecPalRuntimeBootstrap");
    expect(nativeFacades).not.toHaveProperty("executeNativeCommand");
  });

  it("keeps the prepared facades as inert stubs", async () => {
    await expect(nativeFacades.SecPalDeviceState.getSnapshot()).resolves.toBe(
      null
    );
    await expect(nativeFacades.SecPalEnterprise.getEnrollment()).resolves.toBe(
      null
    );
    await expect(nativeFacades.SecPalPush.getRegistration()).resolves.toBe(
      null
    );
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.getRuntimeInfo()
    ).resolves.toBe(null);
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.getRuntimeBootstrap()
    ).resolves.toBe(null);
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.setRuntimeBootstrap({
        api_base_url: "https://api.secpal.dev/v1",
        instance: {
          display_name: "SecPal Demo",
        },
        compatibility: {
          bootstrap_version: "v1",
          schema_version: 3,
          minimum_supported_app_version: "1.4.0",
          minimum_supported_app_build: 10400,
        },
        features: {
          password_login: true,
          passkey_login: true,
          managed_android_enrollment: true,
          notification_channels: {
            android_fcm: false,
            web_push: false,
          },
        },
      })
    ).resolves.toBeUndefined();
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.clearRuntimeBootstrap()
    ).resolves.toBeUndefined();
  });

  it("delegates runtime bootstrap calls to the shared native auth bridge without exposing bearer tokens", async () => {
    const getRuntimeInfo = vi.fn().mockResolvedValue({
      clientPlatform: "android",
      appVersion: "1.4.0",
      appBuild: 10400,
    });
    const getRuntimeBootstrap = vi.fn().mockResolvedValue({
      configured: true,
      bootstrap: {
        instanceDisplayName: "SecPal Demo",
        apiOrigin: "https://api.secpal.dev",
        rawApiBaseUrl: "https://api.secpal.dev/v1",
        minimumSupportedAppVersion: "1.4.0",
        minimumSupportedAppBuild: 10400,
      },
    });
    const setRuntimeBootstrap = vi.fn().mockResolvedValue(undefined);
    const clearRuntimeBootstrap = vi.fn().mockResolvedValue(undefined);

    nativeGlobal.SecPalNativeAuthBridge = {
      getRuntimeInfo,
      getRuntimeBootstrap,
      setRuntimeBootstrap,
      clearRuntimeBootstrap,
      getCurrentUser: vi.fn(),
      logout: vi.fn(),
      request: vi.fn(),
    };

    await expect(
      nativeFacades.SecPalRuntimeBootstrap.getRuntimeInfo()
    ).resolves.toEqual({
      clientPlatform: "android",
      appVersion: "1.4.0",
      appBuild: 10400,
    });
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.getRuntimeBootstrap()
    ).resolves.toEqual({
      configured: true,
      bootstrap: {
        instanceDisplayName: "SecPal Demo",
        apiOrigin: "https://api.secpal.dev",
        rawApiBaseUrl: "https://api.secpal.dev/v1",
        minimumSupportedAppVersion: "1.4.0",
        minimumSupportedAppBuild: 10400,
      },
    });

    await expect(
      nativeFacades.SecPalRuntimeBootstrap.setRuntimeBootstrap({
        api_base_url: "https://api.secpal.dev/v1",
        instance: {
          display_name: "SecPal Demo",
        },
        compatibility: {
          bootstrap_version: "v1",
          schema_version: 3,
          minimum_supported_app_version: "1.4.0",
          minimum_supported_app_build: 10400,
        },
        features: {
          password_login: true,
          passkey_login: true,
          managed_android_enrollment: true,
          notification_channels: {
            android_fcm: true,
            web_push: false,
          },
        },
        notification_channels: {
          android_fcm: {
            channel: "android_fcm",
            metadata_revision: 3,
            public_runtime_metadata: {
              api_key: "public-client-api-key-demo-1234567890",
              project_id: "secpal-demo-push",
              application_id: "1:1234567890:android:abcdef1234567890",
              sender_id: "1234567890",
            },
          },
        },
      })
    ).resolves.toBeUndefined();
    await expect(
      nativeFacades.SecPalRuntimeBootstrap.clearRuntimeBootstrap()
    ).resolves.toBeUndefined();

    expect(setRuntimeBootstrap).toHaveBeenCalledWith({
      instanceDisplayName: "SecPal Demo",
      apiOrigin: "https://api.secpal.dev",
      rawApiBaseUrl: "https://api.secpal.dev/v1",
      minimumSupportedAppVersion: "1.4.0",
      minimumSupportedAppBuild: 10400,
      androidPush: {
        provider: "fcm",
        metadataRevision: 3,
        publicClientMetadata: {
          apiKey: "public-client-api-key-demo-1234567890",
          projectId: "secpal-demo-push",
          applicationId: "1:1234567890:android:abcdef1234567890",
          senderId: "1234567890",
        },
      },
      features: {
        passwordLoginEnabled: true,
        passkeyLoginEnabled: true,
        managedAndroidEnrollment: true,
      },
    });
    expect(clearRuntimeBootstrap).toHaveBeenCalledOnce();
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty("token");
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty(
      "getBearerToken"
    );
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty("request");
  });
});
