// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { AUTH_VAULT_LIFECYCLE_LOCK_NAME } from "./offlineVaultKeys";
import { awaitAbortable } from "./abortablePromise";

export type VaultLifecycleLockAcquisition =
  { status: "acquired" } | { status: "failed"; error: unknown };

export interface VaultLifecycleLockReservation {
  acquired: Promise<VaultLifecycleLockAcquisition>;
  release: () => void;
  signal: AbortSignal;
}

function getAbortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException("The operation was aborted.", "AbortError")
  );
}

export async function runWithOfflineVaultLifecycleLock<T>(
  operation: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (!lockManager) {
    throw new DOMException(
      "Secure offline vault lifecycle coordination requires Web Locks.",
      "NotSupportedError"
    );
  }

  return lockManager.request(
    AUTH_VAULT_LIFECYCLE_LOCK_NAME,
    { mode: "exclusive", signal },
    () =>
      awaitAbortable(
        Promise.resolve().then(() => operation(signal)),
        signal
      )
  );
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
