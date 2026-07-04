// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { clearBrowserPushInstallationId } from "./browserPushState";
import { db } from "./db";
import { AUTH_VAULT_STORAGE_KEY } from "./offlineVaultKeys";

async function loadOfflineVaultModule() {
  return await import("./offlineVault");
}

export const SENSITIVE_CACHE_NAMES = [
  "api-cache",
  "api-users",
  "api-general",
] as const;

const USER_SCOPED_LOCAL_STORAGE_KEYS = [
  "auth_user",
  "auth_token",
  "secpal-notification-preferences",
  AUTH_VAULT_STORAGE_KEY,
] as const;

async function clearSensitiveCaches(): Promise<void> {
  if (!("caches" in globalThis)) {
    return;
  }

  const cacheNames = await caches.keys();
  const sensitiveCacheNames = cacheNames.filter((cacheName) =>
    SENSITIVE_CACHE_NAMES.includes(
      cacheName as (typeof SENSITIVE_CACHE_NAMES)[number]
    )
  );

  await Promise.all(
    sensitiveCacheNames.map((cacheName) => caches.delete(cacheName))
  );
}

async function clearSensitiveIndexedDbState(): Promise<void> {
  try {
    // Logout policy: remove the entire local session database because all
    // stores in SecPalDB are session- or user-adjacent and unnecessary once
    // the authenticated client state is cleared.
    await db.delete();
  } catch (error) {
    console.warn(
      "Failed to delete SecPalDB during logout, falling back to table clearing:",
      error
    );

    await Promise.all([
      db.analytics.clear(),
      db.organizationalUnitCache.clear(),
      db.vaultProfile.clear(),
      db.vaultAnalytics.clear(),
      db.vaultOrganizationalUnitCache.clear(),
    ]);
  }
}

export async function clearBrowserPushClientState(): Promise<void> {
  clearBrowserPushInstallationId();

  if (
    typeof navigator === "undefined" ||
    navigator.serviceWorker === undefined
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (
      registration === undefined ||
      registration.pushManager === undefined ||
      typeof registration.pushManager.getSubscription !== "function"
    ) {
      return;
    }

    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn(
      "Failed to clear browser push subscription during logout:",
      error
    );
  }
}

async function waitForSensitiveCleanupTasks(
  cleanupTasks: Promise<void>[]
): Promise<void> {
  const cleanupResults = await Promise.allSettled(cleanupTasks);
  const cleanupErrors = cleanupResults
    .filter(
      (cleanupResult): cleanupResult is PromiseRejectedResult =>
        cleanupResult.status === "rejected"
    )
    .map((cleanupResult) => cleanupResult.reason);

  if (cleanupErrors.length === 0) {
    return;
  }

  if (cleanupErrors.length === 1) {
    throw cleanupErrors[0];
  }

  throw new AggregateError(
    cleanupErrors,
    "Failed to clear all sensitive client state"
  );
}

export async function clearDestructiveSensitiveClientState(): Promise<void> {
  for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();

  const vaultCleanupTask = loadOfflineVaultModule()
    .then(({ clearOfflineVaultSession, clearRecentAuthVaultKeyMaterials }) => {
      clearOfflineVaultSession();
      clearRecentAuthVaultKeyMaterials();
    })
    .catch((error: unknown) => {
      console.warn(
        "Failed to clear the offline vault runtime during logout cleanup; continuing with the remaining sensitive cleanup tasks:",
        error
      );
    });

  await waitForSensitiveCleanupTasks([
    vaultCleanupTask,
    clearSensitiveCaches(),
    clearSensitiveIndexedDbState(),
  ]);
}

export async function clearSensitiveClientState(): Promise<void> {
  await clearDestructiveSensitiveClientState();
  await clearBrowserPushClientState();
}
