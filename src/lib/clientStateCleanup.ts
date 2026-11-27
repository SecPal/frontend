// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  clearBrowserPushInstallationId,
  peekBrowserPushInstallationId,
} from "./browserPushState";
import { runAuthStateTransaction } from "./authStateTransaction";
import { awaitAbortable, throwIfAborted } from "./abortablePromise";
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
  isCurrent: () => boolean = () => true,
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);
  if (!isCurrent()) {
    return;
  }

  const serviceWorker = globalThis.navigator?.serviceWorker;
  if (typeof serviceWorker?.getRegistration !== "function") {
    if (peekBrowserPushInstallationId() !== null) {
      throw new Error("Browser push subscription state is unavailable.");
    }
    return;
  }

  const registration = await awaitAbortable(
    serviceWorker.getRegistration(),
    signal
  );
  if (!isCurrent()) {
    return;
  }

  if (
    registration &&
    typeof registration.pushManager?.getSubscription !== "function"
  ) {
    if (peekBrowserPushInstallationId() !== null) {
      throw new Error("Browser push subscription state is unavailable.");
    }
    return;
  }

  if (registration) {
    const subscription = await awaitAbortable(
      registration.pushManager.getSubscription(),
      signal
    );
    if (!isCurrent()) {
      return;
    }
    if (subscription !== null) {
      // The browser resolves false when this specific subscription is already
      // deactivated. Rejection and cancellation provide no proof.
      await awaitAbortable(subscription.unsubscribe(), signal);
    }
  }

  throwIfAborted(signal);
  if (isCurrent()) {
    clearBrowserPushInstallationId();
  }
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

export function clearTrailingSensitiveClientState(
  isCurrent: () => boolean = () => true
): Promise<void> {
  return clearSensitiveCaches(isCurrent);
}
