// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

const nativeEnterprisePluginMock = vi.hoisted(() => ({
  openOssLicenses: undefined as (() => Promise<void>) | undefined,
}));

const capacitorMock = vi.hoisted(() => ({
  isPluginAvailable: vi.fn(() => false),
  PluginHeaders: [] as Array<{
    name: string;
    methods: Array<{ name: string }>;
  }>,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorMock,
  registerPlugin: vi.fn(() => nativeEnterprisePluginMock),
}));

import * as nativeFacades from "./index";

const nativeGlobal = globalThis as typeof globalThis & {
  SecPalNativeAuthBridge?: unknown;
};

afterEach(() => {
  delete nativeGlobal.SecPalNativeAuthBridge;
  capacitorMock.isPluginAvailable.mockReset();
  capacitorMock.isPluginAvailable.mockReturnValue(false);
  capacitorMock.PluginHeaders = [];
  nativeEnterprisePluginMock.openOssLicenses = undefined;
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
    await expect(
      nativeFacades.SecPalEnterprise.openOssLicenses()
    ).resolves.toBe(false);
    expect(nativeFacades.SecPalEnterprise.isOssLicensesAvailable()).toBe(false);
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
          schema_version: 4,
          minimum_supported_app_version: "1.4.0",
          minimum_supported_app_build: 10400,
        },
        features: {
          password_login: true,
          passkey_login: true,
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

  it("opens OSS notices through the native enterprise capability when available", async () => {
    const openOssLicenses = vi.fn().mockResolvedValue(undefined);
    capacitorMock.isPluginAvailable.mockReturnValue(true);
    capacitorMock.PluginHeaders = [
      {
        name: "SecPalEnterprise",
        methods: [{ name: "openOssLicenses" }],
      },
    ];
    nativeEnterprisePluginMock.openOssLicenses = openOssLicenses;

    expect(nativeFacades.SecPalEnterprise.isOssLicensesAvailable()).toBe(true);
    await expect(
      nativeFacades.SecPalEnterprise.openOssLicenses()
    ).resolves.toBe(true);
    expect(openOssLicenses).toHaveBeenCalledOnce();
  });

  it("hides OSS notices when the native plugin lacks the notices method", async () => {
    const openOssLicenses = vi.fn().mockResolvedValue(undefined);
    capacitorMock.isPluginAvailable.mockReturnValue(true);
    capacitorMock.PluginHeaders = [
      {
        name: "SecPalEnterprise",
        methods: [{ name: "getManagedState" }],
      },
    ];
    nativeEnterprisePluginMock.openOssLicenses = openOssLicenses;

    expect(nativeFacades.SecPalEnterprise.isOssLicensesAvailable()).toBe(false);
    await expect(
      nativeFacades.SecPalEnterprise.openOssLicenses()
    ).resolves.toBe(false);
    expect(openOssLicenses).not.toHaveBeenCalled();
  });

  it("returns false when the native OSS notices capability rejects", async () => {
    capacitorMock.isPluginAvailable.mockReturnValue(true);
    capacitorMock.PluginHeaders = [
      {
        name: "SecPalEnterprise",
        methods: [{ name: "openOssLicenses" }],
      },
    ];
    nativeEnterprisePluginMock.openOssLicenses = vi
      .fn()
      .mockRejectedValue(new Error("Native notices activity is unavailable"));

    await expect(
      nativeFacades.SecPalEnterprise.openOssLicenses()
    ).resolves.toBe(false);
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
          schema_version: 4,
          minimum_supported_app_version: "1.4.0",
          minimum_supported_app_build: 10400,
        },
        features: {
          password_login: true,
          passkey_login: true,
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
      },
    });
    expect(clearRuntimeBootstrap).toHaveBeenCalledOnce();
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty("token");
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty(
      "getBearerToken"
    );
    expect(nativeFacades.SecPalRuntimeBootstrap).not.toHaveProperty("request");
  });

  it("fails closed when an Android bridge exposes runtime discovery without bootstrap apply", async () => {
    nativeGlobal.SecPalNativeAuthBridge = {
      getRuntimeInfo: vi.fn().mockResolvedValue({
        clientPlatform: "android",
        appVersion: "1.4.0",
        appBuild: 10400,
      }),
      getRuntimeBootstrap: vi.fn().mockResolvedValue({ configured: false }),
    };

    await expect(
      nativeFacades.SecPalRuntimeBootstrap.setRuntimeBootstrap({
        api_base_url: "https://api.secpal.dev/v1",
        instance: {
          display_name: "SecPal Demo",
        },
        compatibility: {
          bootstrap_version: "v1",
          schema_version: 4,
          minimum_supported_app_version: "1.4.0",
          minimum_supported_app_build: 10400,
        },
        features: {
          password_login: true,
          passkey_login: true,
          notification_channels: {
            android_fcm: false,
            web_push: false,
          },
        },
      })
    ).rejects.toThrow(
      "Android runtime bootstrap apply is unavailable in this native shell."
    );
  });
});
