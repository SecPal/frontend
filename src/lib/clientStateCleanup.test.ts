// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "./db";
import {
  getOrCreateBrowserPushInstallationId,
  peekBrowserPushInstallationId,
} from "./browserPushState";
import {
  clearBrowserPushClientState,
  clearDestructiveSensitiveClientState,
  clearSensitiveClientState,
  SENSITIVE_CACHE_NAMES,
} from "./clientStateCleanup";
import {
  getActiveOfflineVaultSession,
  setActiveOfflineVaultSession,
} from "./offlineVaultRuntime";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
} from "./offlineVault";

const mockCaches = {
  keys: vi.fn(),
  delete: vi.fn(),
};

const mockPushSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(true),
};

const mockPushManager = {
  getSubscription: vi.fn(),
};

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

async function flushAsyncWork(iterations = 5): Promise<void> {
  for (let index = 0; index < iterations; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("clearSensitiveClientState", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    await db.delete();
    await db.open();

    localStorage.clear();
    sessionStorage.clear();

    // @ts-expect-error Test cache API mock
    globalThis.caches = mockCaches;

    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: mockPushManager,
        }),
        ready: Promise.resolve({
          pushManager: mockPushManager,
        }),
      },
      configurable: true,
      writable: true,
    });

    mockCaches.keys.mockResolvedValue([]);
    mockCaches.delete.mockResolvedValue(true);
    mockPushManager.getSubscription.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears auth storage, sensitive caches, and deletes the IndexedDB database", async () => {
    const deleteSpy = vi.spyOn(db, "delete");

    localStorage.setItem("auth_user", "opaque-auth-storage-envelope");
    localStorage.setItem("auth_token", "legacy-token");
    localStorage.setItem(
      "secpal-notification-preferences",
      JSON.stringify([{ category: "alerts", enabled: false }])
    );
    localStorage.setItem(
      AUTH_VAULT_STORAGE_KEY,
      JSON.stringify({ scheme: "pbkdf2-aes-cbc-hmac-sha256-vault" })
    );
    localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "1");
    localStorage.setItem("locale", "de");
    sessionStorage.setItem("share-draft", "pending");

    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
    });
    await db.organizationalUnitCache.add({
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cachedAt: new Date(),
      lastSynced: new Date(),
    });

    mockCaches.keys.mockResolvedValue([
      "static-assets",
      SENSITIVE_CACHE_NAMES[0],
      SENSITIVE_CACHE_NAMES[2],
    ]);
    mockCaches.delete.mockResolvedValue(true);

    await clearSensitiveClientState();

    expect(deleteSpy).toHaveBeenCalledTimes(1);

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("secpal-notification-preferences")).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(
      localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)
    ).toBeNull();
    expect(localStorage.getItem("locale")).toBe("de");
    expect(sessionStorage.getItem("share-draft")).toBeNull();

    if (typeof indexedDB.databases === "function") {
      const databases = await indexedDB.databases();

      expect(databases.map((database) => database.name)).not.toContain(db.name);
    }

    await db.open();

    expect(await db.analytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);

    expect(mockCaches.delete).toHaveBeenCalledWith(SENSITIVE_CACHE_NAMES[0]);
    expect(mockCaches.delete).toHaveBeenCalledWith(SENSITIVE_CACHE_NAMES[2]);
    expect(mockCaches.delete).not.toHaveBeenCalledWith("static-assets");
  });

  it("falls back to clearing IndexedDB tables when deleting the database fails", async () => {
    const deleteError = new Error("Delete blocked by another connection");
    const deleteSpy = vi.spyOn(db, "delete").mockRejectedValueOnce(deleteError);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    localStorage.setItem("auth_user", "opaque-auth-storage-envelope");
    localStorage.setItem(
      "secpal-notification-preferences",
      JSON.stringify([{ category: "alerts", enabled: true }])
    );
    sessionStorage.setItem("share-draft", "pending");

    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
    });
    await db.organizationalUnitCache.add({
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      cachedAt: new Date(),
      lastSynced: new Date(),
    });

    mockCaches.keys.mockResolvedValue([]);

    await clearSensitiveClientState();

    expect(deleteSpy).toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith(
      "Failed to delete SecPalDB during logout, falling back to table clearing:",
      deleteError
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("secpal-notification-preferences")).toBeNull();
    expect(sessionStorage.getItem("share-draft")).toBeNull();
    expect(await db.analytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);
  });

  it("does not start IndexedDB cleanup after lifecycle invalidation", async () => {
    const controller = new AbortController();
    const deleteSpy = vi.spyOn(db, "delete");
    controller.abort();

    await expect(
      clearSensitiveClientState({ signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("does not start a delayed IndexedDB transaction after cleanup times out", async () => {
    vi.useFakeTimers();
    const transactionMayStart = createDeferredPromise<void>();
    const clearSpies = db.tables.map((table) => vi.spyOn(table, "clear"));
    vi.spyOn(db, "transaction").mockImplementation((async (
      ...args: unknown[]
    ) => {
      const operation = args[args.length - 1] as () => Promise<void>;
      await transactionMayStart.promise;
      return operation();
    }) as typeof db.transaction);
    const controller = new AbortController();

    try {
      const cleanupPromise = clearDestructiveSensitiveClientState({
        signal: controller.signal,
      });
      const cleanupAssertion = expect(cleanupPromise).rejects.toMatchObject({
        name: "TimeoutError",
      });
      await vi.advanceTimersByTimeAsync(5_000);

      await cleanupAssertion;
      transactionMayStart.resolve();
      await Promise.resolve();
      await Promise.resolve();

      for (const clearSpy of clearSpies) {
        expect(clearSpy).not.toHaveBeenCalled();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps unbounded Cache API work outside destructive lifecycle cleanup", async () => {
    mockCaches.keys.mockResolvedValue([SENSITIVE_CACHE_NAMES[0]]);
    mockCaches.delete.mockReturnValue(new Promise<boolean>(() => {}));

    await expect(
      clearDestructiveSensitiveClientState()
    ).resolves.toBeUndefined();

    expect(mockCaches.keys).not.toHaveBeenCalled();
    expect(mockCaches.delete).not.toHaveBeenCalled();
  });

  it("does not fail when Cache API is unavailable", async () => {
    // @ts-expect-error Simulate unsupported Cache API
    delete globalThis.caches;

    await expect(clearSensitiveClientState()).resolves.not.toThrow();
  });

  it("unsubscribes the existing browser push subscription and clears the local installation id", async () => {
    const installationId = getOrCreateBrowserPushInstallationId();

    mockPushManager.getSubscription.mockResolvedValueOnce(mockPushSubscription);

    await clearSensitiveClientState();

    expect(mockPushSubscription.unsubscribe).toHaveBeenCalledTimes(1);
    expect(installationId).not.toBeNull();
    expect(peekBrowserPushInstallationId()).toBeNull();
  });

  it("does not wait for a future service worker registration during browser push cleanup", async () => {
    const getRegistration = vi.fn().mockResolvedValue(undefined);
    const ready = new Promise<ServiceWorkerRegistration>(() => {
      // Intentionally pending to prove cleanup never waits for readiness.
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration,
        ready,
      },
      writable: true,
    });

    const cleanup = clearBrowserPushClientState();
    await Promise.resolve();

    expect(getRegistration).toHaveBeenCalledTimes(1);
    await cleanup;
  });

  it("treats a missing service worker registration lookup as unsupported", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: new Promise<ServiceWorkerRegistration>(() => {
          // Intentionally pending to model an unsupported registration lookup.
        }),
      },
      writable: true,
    });

    await expect(clearBrowserPushClientState()).resolves.toBeUndefined();

    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("waits for IndexedDB cleanup to settle before rejecting after another sensitive cleanup fails", async () => {
    const deleteDeferred = createDeferredPromise<void>();
    const cacheDeleteDeferred = createDeferredPromise<boolean>();
    const cacheError = new Error("cache delete failed");
    const deleteSpy = vi
      .spyOn(db, "delete")
      .mockImplementationOnce(
        () => deleteDeferred.promise as ReturnType<typeof db.delete>
      );
    let settled = false;
    let rejected = false;

    mockCaches.keys.mockResolvedValue([SENSITIVE_CACHE_NAMES[0]]);
    mockCaches.delete.mockImplementationOnce(() => cacheDeleteDeferred.promise);

    const clearPromise = clearSensitiveClientState()
      .catch((error: unknown) => {
        rejected = true;
        throw error;
      })
      .finally(() => {
        settled = true;
      });

    await flushAsyncWork();

    expect(deleteSpy).toHaveBeenCalledTimes(1);

    cacheDeleteDeferred.reject(cacheError);

    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(rejected).toBe(false);

    deleteDeferred.resolve();

    await expect(clearPromise).rejects.toBe(cacheError);
  });

  it("clears the offline vault runtime without lazy module work", async () => {
    const rootKeyBytes = new Uint8Array([1, 2, 3]);
    setActiveOfflineVaultSession({ rootKeyBytes });
    localStorage.setItem("auth_user", "opaque-auth-storage-envelope");
    localStorage.setItem("auth_vault_state", '{"scheme":"secpal-auth-vault"}');
    sessionStorage.setItem("share-draft", "pending");

    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
    });

    await expect(clearSensitiveClientState()).resolves.not.toThrow();

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_vault_state")).toBeNull();
    expect(sessionStorage.getItem("share-draft")).toBeNull();
    await db.open();
    expect(await db.analytics.count()).toBe(0);
    expect(getActiveOfflineVaultSession()).toBeNull();
    expect(rootKeyBytes).toEqual(new Uint8Array([0, 0, 0]));
  });
});
