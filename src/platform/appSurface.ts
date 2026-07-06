// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

const appSurfaces = [
  "web",
  "android-mock",
  "android-native",
  "ios-mock",
  "ios-native",
] as const;

export type AppSurface = (typeof appSurfaces)[number];

const isAppSurface = (value: string): value is AppSurface =>
  appSurfaces.includes(value as AppSurface);

const resolveAppSurface = (): AppSurface => {
  const configuredSurface = import.meta.env.VITE_APP_SURFACE || "web";

  if (!isAppSurface(configuredSurface)) {
    throw new Error(
      `Invalid VITE_APP_SURFACE value "${configuredSurface}". Expected one of: ${appSurfaces.join(", ")}.`
    );
  }

  if (
    import.meta.env.PROD &&
    (configuredSurface === "android-mock" || configuredSurface === "ios-mock")
  ) {
    throw new Error(
      `VITE_APP_SURFACE value "${configuredSurface}" is not allowed in production builds. Use a native or web surface.`
    );
  }

  return configuredSurface;
};

export const appSurface = resolveAppSurface();
export const isWebSurface = appSurface === "web";
export const isAndroidMockSurface = appSurface === "android-mock";
export const isAndroidNativeSurface = appSurface === "android-native";
export const isAndroidSurface =
  isAndroidMockSurface || isAndroidNativeSurface;
export const isIosMockSurface = appSurface === "ios-mock";
export const isIosNativeSurface = appSurface === "ios-native";
export const isIosSurface = isIosMockSurface || isIosNativeSurface;
export const isNativeSurface = isAndroidNativeSurface || isIosNativeSurface;
