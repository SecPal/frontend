// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Capacitor } from "@capacitor/core";

export const runtimePlatform = Capacitor.getPlatform();
export const isNativeRuntime = Capacitor.isNativePlatform();
export const isWebRuntime = runtimePlatform === "web";
export const isAndroidRuntime = runtimePlatform === "android";
export const isIosRuntime = runtimePlatform === "ios";
