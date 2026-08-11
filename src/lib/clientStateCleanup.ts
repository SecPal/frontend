// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { clearBrowserPushInstallationId } from "./browserPushState";
import Dexie, { type Transaction } from "dexie";
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
const SENSITIVE_INDEXED_DB_CLEANUP_TIMEOUT_MS = 5_000;

interface SensitiveClientStateCleanupOptions {
  signal?: AbortSignal;
}

function getAbortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException("The operation was aborted.", "AbortError")
  );
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw getAbortReason(signal);
  }
}

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

async function clearSensitiveIndexedDbState(
  signal?: AbortSignal
): Promise<void> {
  throwIfAborted(signal);

  if (signal) {
    let activeTransaction: Transaction | null = null;
    let cleanupTimedOut = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const timeoutError = new DOMException(
      "Sensitive IndexedDB cleanup timed out.",
      "TimeoutError"
    );
    const throwIfCleanupCannotContinue = () => {
      if (cleanupTimedOut) {
        throw timeoutError;
      }

      throwIfAborted(signal);
    };
    let rejectAbort!: (reason: unknown) => void;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = reject;
    });
    const handleAbort = () => {
      activeTransaction?.abort();
      rejectAbort(getAbortReason(signal));
    };

    signal.addEventListener("abort", handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
    }

    const transaction = db.transaction("rw", db.tables, async () => {
      activeTransaction = Dexie.currentTransaction;
      throwIfCleanupCannotContinue();
      await Promise.all(db.tables.map((table) => table.clear()));
      throwIfCleanupCannotContinue();
    });
    void transaction.catch(() => undefined);
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeoutId = globalThis.setTimeout(() => {
        cleanupTimedOut = true;
        activeTransaction?.abort();
        reject(timeoutError);
      }, SENSITIVE_INDEXED_DB_CLEANUP_TIMEOUT_MS);
    });

    try {
      await Promise.race([transaction, aborted, timedOut]);
    } catch (error) {
      if (signal.aborted) {
        throw getAbortReason(signal);
      }

      throw error;
    } finally {
      signal.removeEventListener("abort", handleAbort);
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    }

    return;
  }

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
      db.vaultWrappingKeys.clear(),
      db.vaultAnalytics.clear(),
      db.vaultOrganizationalUnitCache.clear(),
    ]);
  }
}

export async function clearBrowserPushClientState(): Promise<void> {
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

export async function clearDestructiveSensitiveClientState(
  options: SensitiveClientStateCleanupOptions = {}
): Promise<void> {
  const { signal } = options;
  throwIfAborted(signal);

  for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();
  clearActiveOfflineVaultSession();
  clearRecentAuthVaultKeyMaterials();
  await clearSensitiveIndexedDbState(signal);
}

export async function clearTrailingSensitiveClientState(): Promise<void> {
  await waitForSensitiveCleanupTasks([
    clearSensitiveCaches(),
    clearBrowserPushClientState(),
  ]);
}

export async function clearSensitiveClientState(
  options: SensitiveClientStateCleanupOptions = {}
): Promise<void> {
  await clearDestructiveSensitiveClientState(options);
  throwIfAborted(options.signal);
  await clearTrailingSensitiveClientState();
}
