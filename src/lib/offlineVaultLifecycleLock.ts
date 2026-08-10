// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import Dexie from "dexie";
import { DB_NAME } from "./db-constants";
import { AUTH_VAULT_LIFECYCLE_LOCK_NAME } from "./offlineVaultKeys";

interface VaultLifecycleLockRecord {
  name: string;
  ownerToken: string;
  expiresAt: number;
}

export type VaultLifecycleLockAcquisition =
  { status: "acquired" } | { status: "failed"; error: unknown };

export interface VaultLifecycleLockReservation {
  acquired: Promise<VaultLifecycleLockAcquisition>;
  release: () => void;
  signal: AbortSignal;
}

const fallbackLockDatabase = new Dexie(`${DB_NAME}-VaultLifecycleLock`);
fallbackLockDatabase.version(1).stores({ locks: "name" });
const fallbackLocks = fallbackLockDatabase.table<
  VaultLifecycleLockRecord,
  string
>("locks");
const FALLBACK_LOCK_LEASE_MS = 10_000;

function getAbortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException("The operation was aborted.", "AbortError")
  );
}

function createOwnerToken(): string {
  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    ""
  );
}

function waitForFallbackRetry(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, 25);
    const handleAbort = () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      reject(getAbortReason(signal as AbortSignal));
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    if (signal?.aborted) {
      handleAbort();
    }
  });
}

async function tryAcquireFallbackLock(ownerToken: string): Promise<boolean> {
  return fallbackLockDatabase.transaction("rw", fallbackLocks, async () => {
    const activeLock = await fallbackLocks.get(AUTH_VAULT_LIFECYCLE_LOCK_NAME);

    if (activeLock && activeLock.expiresAt > Date.now()) {
      return false;
    }

    await fallbackLocks.put({
      name: AUTH_VAULT_LIFECYCLE_LOCK_NAME,
      ownerToken,
      expiresAt: Date.now() + FALLBACK_LOCK_LEASE_MS,
    });
    return true;
  });
}

async function releaseFallbackLock(ownerToken: string): Promise<void> {
  await fallbackLockDatabase.transaction("rw", fallbackLocks, async () => {
    const activeLock = await fallbackLocks.get(AUTH_VAULT_LIFECYCLE_LOCK_NAME);

    if (activeLock?.ownerToken === ownerToken) {
      await fallbackLocks.delete(AUTH_VAULT_LIFECYCLE_LOCK_NAME);
    }
  });
}

async function runWithFallbackLifecycleLock<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const ownerToken = createOwnerToken();

  while (!(await tryAcquireFallbackLock(ownerToken))) {
    await waitForFallbackRetry(signal);
  }

  if (signal?.aborted) {
    await releaseFallbackLock(ownerToken);
    throw getAbortReason(signal);
  }

  const lifecycleController = new AbortController();
  const handleExternalAbort = () => {
    lifecycleController.abort(getAbortReason(signal as AbortSignal));
  };
  signal?.addEventListener("abort", handleExternalAbort, { once: true });
  if (signal?.aborted) {
    handleExternalAbort();
  }
  const leaseTimeoutId = globalThis.setTimeout(() => {
    lifecycleController.abort(
      new DOMException("The lifecycle lock lease expired.", "AbortError")
    );
  }, FALLBACK_LOCK_LEASE_MS);

  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const handleAbort = () => {
    rejectAbort(getAbortReason(lifecycleController.signal));
  };

  lifecycleController.signal.addEventListener("abort", handleAbort, {
    once: true,
  });
  const result = Promise.resolve().then(() => {
    if (lifecycleController.signal.aborted) {
      throw getAbortReason(lifecycleController.signal);
    }

    return operation(lifecycleController.signal);
  });

  // The protected operation is expected to observe the same AbortSignal. Keep
  // a late rejection handled if its caller has already observed cancellation.
  void result.catch(() => undefined);

  try {
    return await Promise.race([result, aborted]);
  } finally {
    globalThis.clearTimeout(leaseTimeoutId);
    signal?.removeEventListener("abort", handleExternalAbort);
    lifecycleController.signal.removeEventListener("abort", handleAbort);
    await releaseFallbackLock(ownerToken);
  }
}

export async function runWithOfflineVaultLifecycleLock<T>(
  operation: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (lockManager) {
    return lockManager.request(
      AUTH_VAULT_LIFECYCLE_LOCK_NAME,
      { mode: "exclusive", signal },
      () => operation(signal)
    );
  }

  return runWithFallbackLifecycleLock(operation, signal);
}

export function reserveOfflineVaultLifecycleLock(): VaultLifecycleLockReservation {
  let resolveAcquired!: (result: VaultLifecycleLockAcquisition) => void;
  let release!: () => void;
  const acquired = new Promise<VaultLifecycleLockAcquisition>((resolve) => {
    resolveAcquired = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reservationController = new AbortController();

  void runWithOfflineVaultLifecycleLock(async (signal) => {
    if (!signal) {
      resolveAcquired({ status: "acquired" });
      await released;
      return;
    }

    const handleAbort = () => {
      reservationController.abort(getAbortReason(signal));
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    if (signal.aborted) {
      handleAbort();
    }
    resolveAcquired({ status: "acquired" });

    try {
      await Promise.race([
        released,
        new Promise<never>((_resolve, reject) => {
          const handleReservationAbort = () => {
            reject(getAbortReason(reservationController.signal));
          };

          reservationController.signal.addEventListener(
            "abort",
            handleReservationAbort,
            { once: true }
          );
          if (reservationController.signal.aborted) {
            handleReservationAbort();
          }
          void released.finally(() => {
            reservationController.signal.removeEventListener(
              "abort",
              handleReservationAbort
            );
          });
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", handleAbort);
    }
  }).catch((error: unknown) => {
    if (!reservationController.signal.aborted) {
      reservationController.abort(error);
    }
    resolveAcquired({ status: "failed", error });
  });

  return { acquired, release, signal: reservationController.signal };
}
