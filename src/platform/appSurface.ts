// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  resolveAppSurface as resolveConfiguredAppSurface,
  type AppSurface,
} from "./appSurfaceContract";

const resolveRuntimeAppSurface = (): AppSurface => {
  return resolveConfiguredAppSurface(
    import.meta.env.VITE_APP_SURFACE,
    import.meta.env.PROD
  );
};

export const appSurface = resolveRuntimeAppSurface();
export const isWebSurface = appSurface === "web";
export const isAndroidMockSurface = appSurface === "android-mock";
export const isAndroidNativeSurface = appSurface === "android-native";
export const isAndroidSurface = isAndroidMockSurface || isAndroidNativeSurface;
export const isIosMockSurface = appSurface === "ios-mock";
export const isIosNativeSurface = appSurface === "ios-native";
export const isIosSurface = isIosMockSurface || isIosNativeSurface;
export const isNativeSurface = isAndroidNativeSurface || isIosNativeSurface;
