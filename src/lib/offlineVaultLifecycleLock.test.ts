// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { DB_NAME } from "./db-constants";
import { AUTH_VAULT_LIFECYCLE_LOCK_NAME } from "./offlineVaultKeys";
import { runWithOfflineVaultLifecycleLock } from "./offlineVaultLifecycleLock";

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;

  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

async function observePromptSettlement(
  operation: Promise<unknown>
): Promise<string> {
  return Promise.race([
    operation.then(
      () => "completed",
      (error: unknown) =>
        typeof error === "object" && error !== null && "name" in error
          ? String(error.name)
          : "failed"
    ),
    new Promise<string>((resolve) => {
      globalThis.setTimeout(() => resolve("pending"), 50);
    }),
  ]);
}

describe("offline vault lifecycle lock fallback", () => {
  let originalLocksDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "locks"
    );
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, "locks", originalLocksDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "locks");
    }

    vi.restoreAllMocks();
  });

  it("cancels a fallback lock request while another operation owns the lock", async () => {
    const holderStarted = createDeferredPromise<void>();
    const releaseHolder = createDeferredPromise<void>();
    const waitingOperation = vi.fn().mockResolvedValue(undefined);
    const holder = runWithOfflineVaultLifecycleLock(async () => {
      holderStarted.resolve();
      await releaseHolder.promise;
    });
    await holderStarted.promise;

    const controller = new AbortController();
    const waiting = runWithOfflineVaultLifecycleLock(
      waitingOperation,
      controller.signal
    );

    try {
      controller.abort();

      await expect(observePromptSettlement(waiting)).resolves.toBe(
        "AbortError"
      );
      expect(waitingOperation).not.toHaveBeenCalled();
    } finally {
      releaseHolder.resolve();
      await holder;
    }
  });

  it("releases an owned fallback lock when its signal is aborted", async () => {
    const operationStarted = createDeferredPromise<void>();
    const releaseOperation = createDeferredPromise<void>();
    const controller = new AbortController();
    const holder = runWithOfflineVaultLifecycleLock(async () => {
      operationStarted.resolve();
      await releaseOperation.promise;
    }, controller.signal);
    await operationStarted.promise;

    const nextOperation = vi.fn().mockResolvedValue("next");
    const waiting = runWithOfflineVaultLifecycleLock(nextOperation);

    try {
      controller.abort();

      await expect(observePromptSettlement(holder)).resolves.toBe("AbortError");
      await expect(observePromptSettlement(waiting)).resolves.toBe("completed");
      expect(nextOperation).toHaveBeenCalledTimes(1);
    } finally {
      releaseOperation.resolve();
      await Promise.allSettled([holder, waiting]);
    }
  });

  it("keeps an active fallback owner alive beyond the initial lease", async () => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout"],
    });
    const operationStarted = createDeferredPromise<void>();
    const releaseOperation = createDeferredPromise<void>();
    let lifecycleSignal: AbortSignal | undefined;
    let waiting: Promise<string> | null = null;
    const holder = runWithOfflineVaultLifecycleLock(async (signal) => {
      lifecycleSignal = signal;
      operationStarted.resolve();
      await releaseOperation.promise;
      return "completed";
    });
    void holder.catch(() => undefined);

    try {
      await operationStarted.promise;
      await vi.advanceTimersByTimeAsync(10_001);

      expect(lifecycleSignal?.aborted).toBe(false);
      const waitingOperation = vi.fn().mockResolvedValue("next");
      waiting = runWithOfflineVaultLifecycleLock(waitingOperation);
      await vi.advanceTimersByTimeAsync(25);
      expect(waitingOperation).not.toHaveBeenCalled();

      releaseOperation.resolve();
      await expect(holder).resolves.toBe("completed");
      await vi.advanceTimersByTimeAsync(25);
      await expect(waiting).resolves.toBe("next");
      expect(waitingOperation).toHaveBeenCalledTimes(1);
    } finally {
      releaseOperation.resolve();
      await Promise.allSettled([holder, ...(waiting ? [waiting] : [])]);
      vi.useRealTimers();
    }
  });

  it("reclaims an expired fallback owner", async () => {
    const staleOwnerDatabase = new Dexie(`${DB_NAME}-VaultLifecycleLock`);
    staleOwnerDatabase.version(1).stores({ locks: "name" });
    await staleOwnerDatabase.table("locks").put({
      name: AUTH_VAULT_LIFECYCLE_LOCK_NAME,
      ownerToken: "stale-owner",
      expiresAt: 0,
    });
    staleOwnerDatabase.close();

    const operation = vi.fn().mockResolvedValue("recovered");

    await expect(runWithOfflineVaultLifecycleLock(operation)).resolves.toBe(
      "recovered"
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
