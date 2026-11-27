// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { clearBrowserPushInstallationId } from "./browserPushState";
import { runAuthStateTransaction } from "./authStateTransaction";
import { throwIfAborted } from "./abortablePromise";
import { db } from "./db";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
} from "./offlineVaultKeys";
import {
  clearActiveOfflineVaultSession,
  clearRecentAuthVaultKeyMaterials,
} from "./offlineVaultRuntime";

export const SENSITIVE_CACHE_NAMES = [
  "api-cache",
  "api-users",
  "api-general",
] as const;

const USER_SCOPED_LOCAL_STORAGE_KEYS = [
  "auth_user",
  "auth_token",
  "secpal-notification-preferences",
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
] as const;

async function clearSensitiveCaches(isCurrent: () => boolean): Promise<void> {
  if (!isCurrent() || !("caches" in globalThis)) {
    return;
  }

  const cacheNames = await caches.keys();
  if (!isCurrent()) {
    return;
  }
  const sensitiveCacheNames = cacheNames.filter((cacheName) =>
    SENSITIVE_CACHE_NAMES.includes(
      cacheName as (typeof SENSITIVE_CACHE_NAMES)[number]
    )
  );

  await Promise.all(
    sensitiveCacheNames.map((cacheName) => caches.delete(cacheName))
  );
}

export async function clearBrowserPushClientState(
  isCurrent: () => boolean = () => true
): Promise<void> {
  if (!isCurrent()) {
    return;
  }
  clearBrowserPushInstallationId();

  if (
    typeof navigator === "undefined" ||
    navigator.serviceWorker === undefined ||
    typeof navigator.serviceWorker.getRegistration !== "function"
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();

    if (
      !isCurrent() ||
      registration === undefined ||
      registration.pushManager === undefined ||
      typeof registration.pushManager.getSubscription !== "function"
    ) {
      return;
    }

    const subscription = await registration.pushManager.getSubscription();

    if (subscription && isCurrent()) {
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

export async function clearDestructiveSensitiveClientState({
  signal,
}: {
  signal: AbortSignal;
}): Promise<void> {
  throwIfAborted(signal);

  for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();
  clearActiveOfflineVaultSession();
  clearRecentAuthVaultKeyMaterials();
  await runAuthStateTransaction(
    db.tables,
    async () => {
      await Promise.all(db.tables.map((table) => table.clear()));
    },
    signal
  );
}

export async function clearTrailingSensitiveClientState(
  isCurrent: () => boolean = () => true
): Promise<void> {
  await waitForSensitiveCleanupTasks([
    clearSensitiveCaches(isCurrent),
    clearBrowserPushClientState(isCurrent),
  ]);
}
