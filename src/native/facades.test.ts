// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";

import * as nativeFacades from "./index";

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
});
