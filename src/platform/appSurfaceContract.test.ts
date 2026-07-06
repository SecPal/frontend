// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { getAppSurfaceMode, resolveAppSurface } from "./appSurfaceContract";

describe("appSurfaceContract", () => {
  it.each([
    ["web", false, "web"],
    ["android-mock", false, "android-mock"],
    ["android-native", true, "android-native"],
    ["ios-mock", false, "ios-mock"],
    ["ios-native", true, "ios-native"],
    ["", false, "web"],
    [undefined, false, "web"],
  ] as const)(
    "resolves %s with production=%s to %s",
    (configuredSurface, isProduction, expectedSurface) => {
      expect(resolveAppSurface(configuredSurface, isProduction)).toBe(
        expectedSurface
      );
    }
  );

  it.each(["android-mock", "ios-mock"] as const)(
    "rejects %s during production build planning",
    (configuredSurface) => {
      expect(() => resolveAppSurface(configuredSurface, true)).toThrow(
        `VITE_APP_SURFACE value "${configuredSurface}" is not allowed in production builds. Use a native or web surface.`
      );
    }
  );

  it("rejects invalid surface values before build/runtime setup continues", () => {
    expect(() => resolveAppSurface("desktop", false)).toThrow(
      'Invalid VITE_APP_SURFACE value "desktop". Expected one of: web, android-mock, android-native, ios-mock, ios-native.'
    );
  });

  it.each([
    ["web", "web"],
    ["android-mock", "android"],
    ["android-native", "android"],
    ["ios-mock", "ios"],
    ["ios-native", "ios"],
  ] as const)("maps %s to the %s Vite mode family", (surface, expectedMode) => {
    expect(getAppSurfaceMode(surface)).toBe(expectedMode);
  });
});
