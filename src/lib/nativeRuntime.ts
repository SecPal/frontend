// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

interface CapacitorRuntime {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

const NATIVE_PWA_RELOAD_MARKER = "secpal-native-pwa-cleanup-reload";

function getCapacitorRuntime(): CapacitorRuntime | undefined {
  return (globalThis as { Capacitor?: CapacitorRuntime }).Capacitor;
}

export function isCapacitorNativeRuntime(): boolean {
  const capacitor = getCapacitorRuntime();

  if (capacitor === undefined) {
    return false;
  }

  if (typeof capacitor.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }

  if (typeof capacitor.getPlatform === "function") {
    return capacitor.getPlatform() !== "web";
  }

  return false;
}

export async function disableBrowserPwaStateForNativeRuntime(): Promise<boolean> {
  if (
    !isCapacitorNativeRuntime() ||
    typeof navigator === "undefined" ||
    navigator.serviceWorker === undefined
  ) {
    return false;
  }

  let didCleanup = navigator.serviceWorker.controller !== null;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length > 0) {
      didCleanup = true;
    }

    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
  } catch (error) {
    console.warn(
      "[Native Runtime] Failed to unregister service workers:",
      error
    );
  }

  if (typeof caches === "undefined") {
    return didCleanup;
  }

  try {
    const cacheKeys = await caches.keys();

    if (cacheKeys.length > 0) {
      didCleanup = true;
    }

    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  } catch (error) {
    console.warn("[Native Runtime] Failed to clear browser caches:", error);
  }

  return didCleanup;
}

export function shouldReloadAfterNativePwaCleanup(): boolean {
  if (typeof sessionStorage === "undefined") {
    return false;
  }

  try {
    const reloadAlreadyTriggered =
      sessionStorage.getItem(NATIVE_PWA_RELOAD_MARKER) === "1";

    if (reloadAlreadyTriggered) {
      sessionStorage.removeItem(NATIVE_PWA_RELOAD_MARKER);
      return false;
    }

    sessionStorage.setItem(NATIVE_PWA_RELOAD_MARKER, "1");
    return true;
  } catch (error) {
    console.warn(
      "[Native Runtime] Failed to access sessionStorage for reload guard:",
      error
    );
    return false;
  }
}
