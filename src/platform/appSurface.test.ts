// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

describe("app surface", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the web surface", async () => {
    vi.stubEnv("VITE_APP_SURFACE", "");

    const surface = await import("./appSurface");

    expect(surface.appSurface).toBe("web");
    expect(surface.isWebSurface).toBe(true);
    expect(surface.isAndroidMockSurface).toBe(false);
    expect(surface.isAndroidNativeSurface).toBe(false);
    expect(surface.isAndroidSurface).toBe(false);
    expect(surface.isIosMockSurface).toBe(false);
    expect(surface.isIosNativeSurface).toBe(false);
    expect(surface.isIosSurface).toBe(false);
    expect(surface.isNativeSurface).toBe(false);
  });

  it.each([
    [
      "android-mock",
      {
        isAndroidMockSurface: true,
        isAndroidNativeSurface: false,
        isAndroidSurface: true,
        isIosMockSurface: false,
        isIosNativeSurface: false,
        isIosSurface: false,
        isNativeSurface: false,
      },
    ],
    [
      "android-native",
      {
        isAndroidMockSurface: false,
        isAndroidNativeSurface: true,
        isAndroidSurface: true,
        isIosMockSurface: false,
        isIosNativeSurface: false,
        isIosSurface: false,
        isNativeSurface: true,
      },
    ],
    [
      "ios-mock",
      {
        isAndroidMockSurface: false,
        isAndroidNativeSurface: false,
        isAndroidSurface: false,
        isIosMockSurface: true,
        isIosNativeSurface: false,
        isIosSurface: true,
        isNativeSurface: false,
      },
    ],
    [
      "ios-native",
      {
        isAndroidMockSurface: false,
        isAndroidNativeSurface: false,
        isAndroidSurface: false,
        isIosMockSurface: false,
        isIosNativeSurface: true,
        isIosSurface: true,
        isNativeSurface: true,
      },
    ],
  ] as const)("exposes flags for %s", async (configuredSurface, flags) => {
    vi.stubEnv("VITE_APP_SURFACE", configuredSurface);

    const surface = await import("./appSurface");

    expect(surface.appSurface).toBe(configuredSurface);
    expect(surface.isWebSurface).toBe(false);
    expect(surface.isAndroidMockSurface).toBe(flags.isAndroidMockSurface);
    expect(surface.isAndroidNativeSurface).toBe(flags.isAndroidNativeSurface);
    expect(surface.isAndroidSurface).toBe(flags.isAndroidSurface);
    expect(surface.isIosMockSurface).toBe(flags.isIosMockSurface);
    expect(surface.isIosNativeSurface).toBe(flags.isIosNativeSurface);
    expect(surface.isIosSurface).toBe(flags.isIosSurface);
    expect(surface.isNativeSurface).toBe(flags.isNativeSurface);
  });

  it("throws a clear error for invalid configured surfaces", async () => {
    vi.stubEnv("VITE_APP_SURFACE", "desktop");

    await expect(import("./appSurface")).rejects.toThrow(
      'Invalid VITE_APP_SURFACE value "desktop". Expected one of: web, android-mock, android-native, ios-mock, ios-native.'
    );
  });

  it.each(["android-mock", "ios-mock"] as const)(
    "rejects %s in production",
    async (configuredSurface) => {
      vi.stubEnv("PROD", true);
      vi.stubEnv("VITE_APP_SURFACE", configuredSurface);

      await expect(import("./appSurface")).rejects.toThrow(
        `VITE_APP_SURFACE value "${configuredSurface}" is not allowed in production builds. Use a native or web surface.`
      );
    }
  );
});
