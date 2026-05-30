// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import { clearBrowserPushInstallationId } from "./browserPushState";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
} from "./offlineVault";

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

async function clearBrowserPushClientState(): Promise<void> {
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
  cleanupTasks: [Promise<void>, Promise<void>, Promise<void>]
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

export async function clearSensitiveClientState(): Promise<void> {
  clearOfflineVaultSession();

  for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();

  await waitForSensitiveCleanupTasks([
    clearBrowserPushClientState(),
    clearSensitiveCaches(),
    clearSensitiveIndexedDbState(),
  ]);
}
