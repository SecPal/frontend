// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import Dexie from "dexie";
import { DB_NAME } from "./db-constants";
import { AUTH_VAULT_LIFECYCLE_LOCK_NAME } from "./offlineVaultKeys";

interface VaultLifecycleLockRecord {
  name: string;
}

export type VaultLifecycleLockAcquisition =
  { status: "acquired" } | { status: "failed"; error: unknown };

export interface VaultLifecycleLockReservation {
  acquired: Promise<VaultLifecycleLockAcquisition>;
  release: () => void;
}

const fallbackLockDatabase = new Dexie(`${DB_NAME}-VaultLifecycleLock`);
fallbackLockDatabase.version(1).stores({ locks: "name" });
const fallbackLocks = fallbackLockDatabase.table<
  VaultLifecycleLockRecord,
  string
>("locks");

export async function runWithOfflineVaultLifecycleLock<T>(
  operation: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (lockManager) {
    return lockManager.request(
      AUTH_VAULT_LIFECYCLE_LOCK_NAME,
      { mode: "exclusive", signal },
      operation
    );
  }

  return fallbackLockDatabase.transaction("rw", fallbackLocks, async () => {
    await fallbackLocks.get(AUTH_VAULT_LIFECYCLE_LOCK_NAME);
    return Dexie.waitFor(operation());
  });
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

  void runWithOfflineVaultLifecycleLock(async () => {
    resolveAcquired({ status: "acquired" });
    await released;
  }).catch((error: unknown) => {
    resolveAcquired({ status: "failed", error });
  });

  return { acquired, release };
}
