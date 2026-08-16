// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithOfflineVaultLifecycleLock } from "./offlineVaultLifecycleLock";

describe("offline vault lifecycle lock", () => {
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

  it("fails closed when Web Locks are unavailable", async () => {
    const operation = vi.fn().mockResolvedValue("unsafe");

    await expect(
      runWithOfflineVaultLifecycleLock(operation)
    ).rejects.toMatchObject({
      name: "NotSupportedError",
    });
    expect(operation).not.toHaveBeenCalled();
  });

  it("settles an acquired Web Lock callback when its operation is aborted", async () => {
    const operation = vi.fn(() => new Promise<never>(() => undefined));
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(
          async <T>(
            name: string,
            options: LockOptions,
            callback: (lock: Lock) => T | PromiseLike<T>
          ): Promise<T> =>
            callback({ name, mode: options.mode ?? "exclusive" } as Lock)
        ),
      },
    });
    const controller = new AbortController();
    const lockedOperation = runWithOfflineVaultLifecycleLock(
      operation,
      controller.signal
    );

    await vi.waitFor(() => {
      expect(operation).toHaveBeenCalledTimes(1);
    });
    controller.abort();

    await expect(lockedOperation).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("does not start an operation after its queued Web Lock request was aborted", async () => {
    const controller = new AbortController();
    const operation = vi.fn().mockResolvedValue("unsafe");
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: vi.fn(
          async <T>(
            name: string,
            options: LockOptions,
            callback: (lock: Lock) => T | PromiseLike<T>
          ): Promise<T> => {
            controller.abort();
            return callback({
              name,
              mode: options.mode ?? "exclusive",
            } as Lock);
          }
        ),
      },
    });

    await expect(
      runWithOfflineVaultLifecycleLock(operation, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();

    expect(operation).not.toHaveBeenCalled();
  });
});
