// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AUTH_VAULT_LIFECYCLE_LOCK_NAME } from "./offlineVaultKeys";
import { awaitAbortable, throwIfAborted } from "./abortablePromise";

export const AUTH_VAULT_LIFECYCLE_TIMEOUT_MS = 5_000;

export async function runWithOfflineVaultLifecycleLock<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  const lockManager = globalThis.navigator?.locks;

  if (!lockManager) {
    throw new DOMException(
      "Secure offline vault lifecycle coordination requires Web Locks.",
      "NotSupportedError"
    );
  }

  throwIfAborted(signal);
  const deadline = new AbortController();
  const lockSignal = signal
    ? AbortSignal.any([signal, deadline.signal])
    : deadline.signal;
  const timeout = globalThis.setTimeout(() => {
    deadline.abort(
      new DOMException("Vault lifecycle lock timed out.", "TimeoutError")
    );
  }, AUTH_VAULT_LIFECYCLE_TIMEOUT_MS);
  try {
    const request = lockManager.request(
      AUTH_VAULT_LIFECYCLE_LOCK_NAME,
      { mode: "exclusive", signal: lockSignal },
      () => {
        throwIfAborted(lockSignal);
        return awaitAbortable(
          Promise.resolve().then(() => {
            throwIfAborted(lockSignal);
            return operation(lockSignal);
          }),
          lockSignal
        );
      }
    );
    void request.catch(() => undefined);
    return await awaitAbortable(request, lockSignal);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
