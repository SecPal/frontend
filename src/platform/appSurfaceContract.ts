// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export const appSurfaces = [
  "web",
  "android-mock",
  "android-native",
  "ios-mock",
  "ios-native",
] as const;

export type AppSurface = (typeof appSurfaces)[number];
export type AppSurfaceMode = "web" | "android" | "ios";

export const isAppSurface = (value: string): value is AppSurface =>
  appSurfaces.includes(value as AppSurface);

export function resolveAppSurface(
  configuredSurface: string | undefined,
  isProduction: boolean
): AppSurface {
  const surface = configuredSurface || "web";

  if (!isAppSurface(surface)) {
    throw new Error(
      `Invalid VITE_APP_SURFACE value "${surface}". Expected one of: ${appSurfaces.join(", ")}.`
    );
  }

  if (isProduction && (surface === "android-mock" || surface === "ios-mock")) {
    throw new Error(
      `VITE_APP_SURFACE value "${surface}" is not allowed in production builds. Use a native or web surface.`
    );
  }

  return surface;
}

export function getAppSurfaceMode(surface: AppSurface): AppSurfaceMode {
  if (surface === "web") {
    return "web";
  }

  if (surface === "android-mock" || surface === "android-native") {
    return "android";
  }

  return "ios";
}
