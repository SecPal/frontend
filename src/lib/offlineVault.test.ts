// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import type { PersistedAuthUser } from "../services/authState";
import { db, type OrganizationalUnitCacheEntry } from "./db";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
  initializeOfflineVault,
  listVaultAnalyticsEvents,
  listVaultOrganizationalUnits,
  readPersistedAuthUserFromVault,
  clearOfflineVaultTables,
  storeVaultAnalyticsEvent,
} from "./offlineVault";

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

function clearCsrfTokenCookie(): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
}

function setCapacitorNativeRuntime(
  value = { isNativePlatform: () => true }
): void {
  Object.defineProperty(globalThis, "Capacitor", {
    configurable: true,
    writable: true,
    value,
  });
}

function setNativeVaultBridge(value: unknown): void {
  Object.defineProperty(globalThis, "SecPalNativeAuthBridge", {
    configurable: true,
    writable: true,
    value,
  });
}

function resetNativeVaultRuntime(): void {
  Reflect.deleteProperty(globalThis as Record<string, unknown>, "Capacitor");
  Reflect.deleteProperty(
    globalThis as Record<string, unknown>,
    "SecPalNativeAuthBridge"
  );
}

function readStoredVaultState(): Record<string, unknown> {
  return JSON.parse(
    localStorage.getItem(AUTH_VAULT_STORAGE_KEY) as string
  ) as Record<string, unknown>;
}

function installNativeVaultBridge(overrides: Record<string, unknown> = {}) {
  setCapacitorNativeRuntime();

  const bridge = {
    isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(false),
    wrapVaultRootKey: vi.fn(),
    unwrapVaultRootKey: vi.fn(),
    ...overrides,
  };

  setNativeVaultBridge(bridge);

  return bridge;
}

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("offlineVault", () => {
  const persistedUser: PersistedAuthUser = {
    id: "user-1",
    name: "Vault User",
    email: "vault@secpal.dev",
    emailVerified: false,
  };

  beforeEach(async () => {
    await db.delete();
    await db.open();
    localStorage.clear();
    sessionStorage.clear();
    setCsrfTokenCookie("test-csrf-token");
    clearOfflineVaultSession();
  });

  afterEach(() => {
    clearOfflineVaultSession();
    resetNativeVaultRuntime();
    vi.restoreAllMocks();
  });

  it("stores the persisted profile in the encrypted vault and keeps auth_user out of localStorage", async () => {
    await initializeOfflineVault(persistedUser);

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(readStoredVaultState().wrapper).toMatchObject({
      kind: "browser-session",
    });
    expect(readStoredVaultState()).not.toHaveProperty("initialization");
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );

    const storedProfile = await db.vaultProfile.get("profile");

    expect(storedProfile).toEqual(
      expect.objectContaining({
        id: "profile",
        ciphertext: expect.any(String),
        iv: expect.any(String),
        authTag: expect.any(String),
      })
    );
  });

  it("persists the encrypted profile when Web Locks are unavailable", async () => {
    const originalLocksDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "locks"
    );

    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });

    try {
      await initializeOfflineVault(persistedUser);

      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
      clearOfflineVaultSession();
      await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
        persistedUser
      );
    } finally {
      if (originalLocksDescriptor) {
        Object.defineProperty(navigator, "locks", originalLocksDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "locks");
      }
    }
  });

  it("abandons a stalled database open when vault persistence is cancelled", async () => {
    db.close();
    const databaseOpen = createDeferredPromise<typeof db>();
    const extendedDatabaseOpen = Dexie.Promise.resolve(databaseOpen.promise);
    const openSpy = vi
      .spyOn(db, "open")
      .mockReturnValueOnce(extendedDatabaseOpen);
    const controller = new AbortController();
    const initialization = initializeOfflineVault(persistedUser, {
      signal: controller.signal,
    });
    let outcome = "pending";
    const observedOutcome = initialization.then(
      () => {
        outcome = "completed";
      },
      (error: unknown) => {
        outcome =
          typeof error === "object" && error !== null && "name" in error
            ? String(error.name)
            : "failed";
      }
    );

    try {
      await vi.waitFor(() => {
        expect(openSpy).toHaveBeenCalledTimes(1);
      });

      controller.abort();
      await vi.waitFor(() => {
        expect(outcome).toBe("AbortError");
      });
    } finally {
      databaseOpen.resolve(db);
      await observedOutcome;
    }
  });

  it.each([
    [vi.fn().mockRejectedValue(new Error("wrap failed")), true],
    [vi.fn().mockResolvedValue({ wrappedRootKey: "" }), false],
  ])(
    "falls back to WebCrypto when the optional native vault wrapper fails",
    async (wrapVaultRootKey, expectsWarning) => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      installNativeVaultBridge({
        isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
        wrapVaultRootKey,
      });

      await initializeOfflineVault(persistedUser);

      expect(readStoredVaultState().wrapper).toMatchObject({
        kind: "webcrypto-device-bound",
      });
      clearOfflineVaultSession();
      await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
        persistedUser
      );
      if (expectsWarning) {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          "[Offline Vault] Native device-bound wrapping failed; using the WebCrypto fallback."
        );
      } else {
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      }
    }
  );

  it("uses one WebCrypto wrapping key across simultaneous native contexts", async () => {
    installNativeVaultBridge();
    const generatedKeys = await Promise.all([
      crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]),
      crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]),
    ]);
    const firstGenerateStarted = createDeferredPromise<void>();
    const releaseFirstGenerate = createDeferredPromise<void>();
    let generateCallCount = 0;
    const generateKeySpy = vi
      .spyOn(crypto.subtle, "generateKey")
      .mockImplementation((() => {
        const callIndex = generateCallCount;
        generateCallCount += 1;

        if (callIndex === 0) {
          firstGenerateStarted.resolve();
          return releaseFirstGenerate.promise.then(() => generatedKeys[0]);
        }

        return Promise.resolve(generatedKeys[1]);
      }) as typeof crypto.subtle.generateKey);
    vi.resetModules();
    const firstVault = await import("./offlineVault");
    const firstDatabase = (await import("./db")).db;
    vi.resetModules();
    const secondVault = await import("./offlineVault");
    const secondDatabase = (await import("./db")).db;
    let firstInitialization: Promise<void> | null = null;
    let secondInitialization: Promise<void> | null = null;

    try {
      firstInitialization = firstVault.initializeOfflineVault(persistedUser);
      await firstGenerateStarted.promise;

      secondInitialization = secondVault.initializeOfflineVault(persistedUser);

      expect(generateKeySpy).toHaveBeenCalledTimes(1);
      releaseFirstGenerate.resolve();

      await Promise.all([firstInitialization, secondInitialization]);

      expect(generateKeySpy).toHaveBeenCalledTimes(1);
      clearOfflineVaultSession();
      await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
        persistedUser
      );
    } finally {
      releaseFirstGenerate.resolve();
      await Promise.allSettled(
        [firstInitialization, secondInitialization].filter(
          (initialization): initialization is Promise<void> =>
            initialization !== null
        )
      );
      firstDatabase.close();
      secondDatabase.close();
    }
  });

  it("keeps a recoverable pending wrapper before the encrypted profile record is persisted", async () => {
    const profileWriteStarted = createDeferredPromise<void>();
    const deferredProfileWrite = createDeferredPromise<void>();
    const originalPut = db.vaultProfile.put.bind(db.vaultProfile);

    vi.spyOn(db.vaultProfile, "put").mockImplementationOnce((...args) => {
      profileWriteStarted.resolve();
      return Dexie.waitFor(deferredProfileWrite.promise).then(() =>
        originalPut(...args)
      ) as ReturnType<typeof originalPut>;
    });

    const initializePromise = initializeOfflineVault(persistedUser);

    await profileWriteStarted.promise;
    expect(readStoredVaultState()).toHaveProperty("initialization", "pending");

    deferredProfileWrite.resolve();
    await initializePromise;

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("preserves a pending vault when an orphaned profile cannot decrypt", async () => {
    await initializeOfflineVault(persistedUser);
    const orphanedProfile = await db.vaultProfile.get("profile");
    const replacementUser = {
      ...persistedUser,
      id: "replacement-user",
      email: "replacement@secpal.dev",
    };
    const profileEncryptionStarted = createDeferredPromise<void>();
    const releaseProfileEncryption = createDeferredPromise<void>();
    const originalEncrypt = crypto.subtle.encrypt.bind(crypto.subtle);
    let delayedProfileEncryption = false;
    vi.spyOn(crypto.subtle, "encrypt").mockImplementation(
      async (algorithm, key, data) => {
        const encryption = originalEncrypt(algorithm, key, data);

        if (
          !delayedProfileEncryption &&
          typeof algorithm !== "string" &&
          algorithm.name === "AES-GCM"
        ) {
          delayedProfileEncryption = true;
          profileEncryptionStarted.resolve();
          await releaseProfileEncryption.promise;
        }

        return encryption;
      }
    );
    const initialization = initializeOfflineVault(replacementUser);

    try {
      await profileEncryptionStarted.promise;
      if (!orphanedProfile) {
        throw new Error("Expected the original encrypted profile record.");
      }
      await db.vaultProfile.put(orphanedProfile);
      const pendingVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
      expect(readStoredVaultState()).toHaveProperty(
        "initialization",
        "pending"
      );
      clearOfflineVaultSession();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      await expect(readPersistedAuthUserFromVault()).resolves.toBeNull();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(
        pendingVaultState
      );
      expect(await db.vaultProfile.count()).toBe(1);
    } finally {
      releaseProfileEncryption.resolve();
      await Promise.allSettled([initialization]);
    }

    clearOfflineVaultSession();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      replacementUser
    );
  });

  it("releases vault initialization when native wrapper discovery is cancelled", async () => {
    const availability = createDeferredPromise<boolean>();
    const nativeBridge = installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn(() => availability.promise),
    });
    const controller = new AbortController();
    const initialization = initializeOfflineVault(persistedUser, {
      signal: controller.signal,
    });

    try {
      await vi.waitFor(() => {
        expect(
          nativeBridge.isVaultDeviceBoundWrapperAvailable
        ).toHaveBeenCalledTimes(1);
      });
      controller.abort();
      await expect(initialization).rejects.toMatchObject({
        name: "AbortError",
      });
    } finally {
      availability.resolve(false);
      await Promise.allSettled([initialization]);
    }
  });

  it("rolls back a profile write when persistence is superseded", async () => {
    const profileWritten = createDeferredPromise<void>();
    const releaseProfileWrite = createDeferredPromise<void>();
    const originalPut = db.vaultProfile.put.bind(db.vaultProfile);

    vi.spyOn(db.vaultProfile, "put").mockImplementationOnce((...args) =>
      originalPut(...args).then((result) => {
        profileWritten.resolve();
        return Dexie.waitFor(releaseProfileWrite.promise).then(() => result);
      })
    );

    const controller = new AbortController();
    const initialization = initializeOfflineVault(persistedUser, {
      signal: controller.signal,
    });

    await profileWritten.promise;
    controller.abort();
    releaseProfileWrite.resolve();
    await expect(initialization).rejects.toMatchObject({ name: "AbortError" });
    expect(await db.vaultProfile.count()).toBe(0);
    expect(readStoredVaultState()).toHaveProperty("initialization", "pending");
    clearOfflineVaultSession();
    await expect(readPersistedAuthUserFromVault()).resolves.toBeNull();
    expect(readStoredVaultState()).toHaveProperty("initialization", "pending");
  });

  it("keeps the vault readable when the browser-session CSRF token rotates", async () => {
    await initializeOfflineVault(persistedUser);

    const initialVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(initialVaultState).not.toBeNull();

    setCsrfTokenCookie("rotated-csrf-token");

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );

    const rotatedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(rotatedVaultState).not.toBeNull();
    expect(rotatedVaultState).not.toBe(initialVaultState);
  });

  it("keeps the vault readable when the current csrf cookie is missing but a recent key is cached", async () => {
    await initializeOfflineVault(persistedUser);

    clearOfflineVaultSession();
    clearCsrfTokenCookie();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
  });

  it("migrates legacy IndexedDB PII into vault-backed stores and clears plaintext records", async () => {
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
      userId: persistedUser.id,
    });

    const organizationalUnit: OrganizationalUnitCacheEntry = {
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      cachedAt: new Date("2026-01-03T00:00:00Z"),
      lastSynced: new Date("2026-01-03T00:00:00Z"),
      parent_id: null,
      parent: null,
    };

    await db.organizationalUnitCache.put(organizationalUnit);

    await initializeOfflineVault(persistedUser);

    expect(await db.analytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);

    await expect(listVaultAnalyticsEvents()).resolves.toEqual([
      expect.objectContaining({
        type: "page_view",
        userId: persistedUser.id,
        sessionId: "session-1",
      }),
    ]);
    await expect(listVaultOrganizationalUnits()).resolves.toEqual([
      expect.objectContaining({
        id: "org-1",
        name: "SecPal GmbH",
      }),
    ]);
  });

  it("rolls back legacy analytics migration when persistence is superseded", async () => {
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
      userId: persistedUser.id,
    });
    const destinationWritten = createDeferredPromise<void>();
    const releaseDestinationWrite = createDeferredPromise<void>();
    const originalBulkPut = db.vaultAnalytics.bulkPut.bind(db.vaultAnalytics);

    vi.spyOn(db.vaultAnalytics, "bulkPut").mockImplementationOnce((records) =>
      originalBulkPut(records).then((result) => {
        destinationWritten.resolve();
        return Dexie.waitFor(releaseDestinationWrite.promise).then(
          () => result
        );
      })
    );

    const controller = new AbortController();
    const initialization = initializeOfflineVault(persistedUser, {
      signal: controller.signal,
    });

    await destinationWritten.promise;
    controller.abort();
    releaseDestinationWrite.resolve();
    await expect(initialization).rejects.toMatchObject({ name: "AbortError" });
    expect(await db.analytics.count()).toBe(1);
    expect(await db.vaultAnalytics.count()).toBe(0);
  });

  it("rolls back all legacy migrations when a sibling migration is superseded", async () => {
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "session-1",
      userId: persistedUser.id,
    });
    await db.organizationalUnitCache.put({
      id: "org-1",
      type: "company",
      name: "SecPal GmbH",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      cachedAt: new Date("2026-01-03T00:00:00Z"),
      lastSynced: new Date("2026-01-03T00:00:00Z"),
      parent_id: null,
      parent: null,
    });

    const organizationalUnitWriteStarted = createDeferredPromise<void>();
    const releaseOrganizationalUnitWrite = createDeferredPromise<void>();
    vi.spyOn(db.vaultOrganizationalUnitCache, "bulkPut").mockImplementationOnce(
      () => {
        organizationalUnitWriteStarted.resolve();
        return Dexie.waitFor(releaseOrganizationalUnitWrite.promise).then(
          () => "org-1"
        ) as unknown as ReturnType<
          typeof db.vaultOrganizationalUnitCache.bulkPut
        >;
      }
    );

    const controller = new AbortController();
    const initialization = initializeOfflineVault(persistedUser, {
      signal: controller.signal,
    });

    await organizationalUnitWriteStarted.promise;

    controller.abort();
    releaseOrganizationalUnitWrite.resolve();

    await expect(initialization).rejects.toMatchObject({ name: "AbortError" });
    expect(await db.analytics.count()).toBe(1);
    expect(await db.vaultAnalytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(1);
    expect(await db.vaultOrganizationalUnitCache.count()).toBe(0);
    expect(readStoredVaultState()).toHaveProperty("initialization", "pending");

    clearOfflineVaultSession();
    await initializeOfflineVault(persistedUser);

    expect(await db.analytics.count()).toBe(0);
    expect(await db.vaultAnalytics.count()).toBe(1);
    expect(await db.organizationalUnitCache.count()).toBe(0);
    expect(await db.vaultOrganizationalUnitCache.count()).toBe(1);
    await expect(listVaultAnalyticsEvents()).resolves.toEqual([
      expect.objectContaining({ sessionId: "session-1" }),
    ]);
    await expect(listVaultOrganizationalUnits()).resolves.toEqual([
      expect.objectContaining({ id: "org-1" }),
    ]);
  });

  it("resumes committed initial records when cancellation lands at transaction completion", async () => {
    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "committed-session",
      userId: persistedUser.id,
    });
    await db.organizationalUnitCache.put({
      id: "committed-org",
      type: "company",
      name: "Committed Organization",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
      cachedAt: new Date("2026-01-03T00:00:00Z"),
      lastSynced: new Date("2026-01-03T00:00:00Z"),
      parent_id: null,
      parent: null,
    });
    const controller = new AbortController();
    const originalProfilePut = db.vaultProfile.put.bind(db.vaultProfile);

    vi.spyOn(db.vaultProfile, "put").mockImplementationOnce((record) => {
      const transaction = Dexie.currentTransaction;

      if (!transaction) {
        throw new Error(
          "Expected initial vault writes to share a transaction."
        );
      }

      transaction.on("complete", () => controller.abort());
      return originalProfilePut(record);
    });

    await expect(
      initializeOfflineVault(persistedUser, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(await db.analytics.count()).toBe(0);
    expect(await db.organizationalUnitCache.count()).toBe(0);
    expect(await db.vaultAnalytics.count()).toBe(1);
    expect(await db.vaultOrganizationalUnitCache.count()).toBe(1);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();

    clearOfflineVaultSession();
    await initializeOfflineVault(persistedUser);
    expect(readStoredVaultState()).not.toHaveProperty("initialization");
    clearOfflineVaultSession();

    await expect(listVaultAnalyticsEvents()).resolves.toEqual([
      expect.objectContaining({ sessionId: "committed-session" }),
    ]);
    await expect(listVaultOrganizationalUnits()).resolves.toEqual([
      expect.objectContaining({ id: "committed-org" }),
    ]);
  });

  it("removes invalid vault state from localStorage when JSON is malformed", async () => {
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, "not-valid-json{{{");

    await initializeOfflineVault(persistedUser);

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("clears vault state and legacy tables when profile record is missing from vault", async () => {
    await initializeOfflineVault(persistedUser);
    expect(await db.vaultProfile.count()).toBe(1);

    await clearOfflineVaultTables();
    clearOfflineVaultSession();

    await db.analytics.add({
      type: "page_view",
      category: "navigation",
      action: "open",
      timestamp: Date.now(),
      synced: false,
      sessionId: "test-session",
    });

    const result = await readPersistedAuthUserFromVault();

    expect(result).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
    expect(await db.analytics.count()).toBe(0);
  });

  it("stores and restores the vault root key through the optional native device-bound wrapper", async () => {
    const wrapVaultRootKey = vi.fn(
      async ({ rootKeyBase64 }: { rootKeyBase64: string }) => ({
        wrappedRootKey: `wrapped:${rootKeyBase64}`,
        metadata: "android-keystore",
      })
    );
    const unwrapVaultRootKey = vi.fn(
      async ({ wrappedRootKey }: { wrappedRootKey: string }) => ({
        rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
      })
    );
    const nativeBridge = installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true),
      wrapVaultRootKey,
      unwrapVaultRootKey,
    });

    await initializeOfflineVault(persistedUser);

    await initializeOfflineVault(persistedUser);

    const { subjectHash, wrapper } = readStoredVaultState() as {
      subjectHash: string;
      wrapper: Record<string, unknown>;
    };

    expect(wrapper).toMatchObject({
      kind: "native-device-bound",
      metadata: "android-keystore",
    });

    clearOfflineVaultSession();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    expect(nativeBridge.unwrapVaultRootKey).toHaveBeenCalledWith(
      expect.objectContaining({
        wrappedRootKey: expect.stringMatching(/^wrapped:/),
        metadata: "android-keystore",
        subjectHash,
      })
    );
  });

  it("cancels a stalled native vault unwrap", async () => {
    let rootKeyBase64 = "";
    installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey: vi.fn(
        async ({ rootKeyBase64: nextRootKey }: { rootKeyBase64: string }) => {
          rootKeyBase64 = nextRootKey;
          return { wrappedRootKey: "wrapped-root-key" };
        }
      ),
      unwrapVaultRootKey: vi.fn(),
    });
    await initializeOfflineVault(persistedUser);
    clearOfflineVaultSession();

    const unwrappedRootKey = createDeferredPromise<{
      rootKeyBase64: string;
    }>();
    const nativeBridge = installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey: vi.fn(),
      unwrapVaultRootKey: vi.fn(() => unwrappedRootKey.promise),
    });
    const controller = new AbortController();
    const read = readPersistedAuthUserFromVault({ signal: controller.signal });

    try {
      await vi.waitFor(() => {
        expect(nativeBridge.unwrapVaultRootKey).toHaveBeenCalledTimes(1);
      });
      controller.abort();
      await expect(read).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      unwrappedRootKey.resolve({ rootKeyBase64 });
      await Promise.allSettled([read]);
    }
  });

  it("decrypts a persisted auth user from a legacy v1 envelope after upgrade", async () => {
    // 1. Create a real vault — produces V2 browser-session envelope with no native bridge installed
    await initializeOfflineVault(persistedUser);

    const v2State = readStoredVaultState() as {
      subjectHash: string;
      wrapper: { kind: string; salt: string; iv: string; ciphertext: string };
    };

    expect(v2State.wrapper.kind).toBe("browser-session");

    // 2. Re-derive the PBKDF2 MAC key using the same key material + same salt
    const b64ToBytes = (b64: string): Uint8Array => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
    const saltBytes = b64ToBytes(v2State.wrapper.salt);
    const baseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("secpal-auth-vault:test-csrf-token"),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: saltBytes.buffer as ArrayBuffer,
        iterations: 600_000,
      },
      baseKey,
      512
    );
    const macKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(derivedBits).slice(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // 3. Compute the V1 MAC (different payload format than V2)
    const v1MacPayload = [
      "pbkdf2-aes-cbc-hmac-sha256-vault",
      "1",
      v2State.subjectHash,
      v2State.wrapper.salt,
      v2State.wrapper.iv,
      v2State.wrapper.ciphertext,
    ].join(":");
    const macBuf = await crypto.subtle.sign(
      "HMAC",
      macKey,
      new TextEncoder().encode(v1MacPayload)
    );
    const mac = btoa(String.fromCharCode(...new Uint8Array(macBuf)));

    // 4. Overwrite localStorage with a valid V1 envelope using the same ciphertext
    localStorage.setItem(
      AUTH_VAULT_STORAGE_KEY,
      JSON.stringify({
        scheme: "pbkdf2-aes-cbc-hmac-sha256-vault",
        version: 1,
        salt: v2State.wrapper.salt,
        iv: v2State.wrapper.iv,
        ciphertext: v2State.wrapper.ciphertext,
        mac,
        subjectHash: v2State.subjectHash,
      })
    );
    clearOfflineVaultSession();

    // 5. Confirm the V1 envelope is still readable after the wrapper upgrade
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
  });

  it("preserves a native-device-bound vault until its wrapper is available again", async () => {
    // Initialize vault with an available native bridge → native-device-bound envelope
    installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey: vi.fn(
        async ({ rootKeyBase64 }: { rootKeyBase64: string }) => ({
          wrappedRootKey: `wrapped:${rootKeyBase64}`,
        })
      ),
      unwrapVaultRootKey: vi.fn(
        async ({ wrappedRootKey }: { wrappedRootKey: string }) => ({
          rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
        })
      ),
    });
    await initializeOfflineVault(persistedUser);
    await storeVaultAnalyticsEvent({
      type: "page_view",
      category: "navigation",
      action: "view_dashboard",
      timestamp: Date.now(),
      synced: false,
      sessionId: "native-session",
      userId: persistedUser.id,
    });

    const storedState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
    expect(readStoredVaultState()).toMatchObject({
      wrapper: { kind: "native-device-bound" },
    });

    // Remove the bridge to simulate a transient unavailability
    setNativeVaultBridge(null);
    clearOfflineVaultSession();

    // Vault must be locked (null) — not corrupted and not cleared
    await expect(readPersistedAuthUserFromVault()).resolves.toBeNull();
    await expect(initializeOfflineVault(persistedUser)).rejects.toThrow(
      "Stored auth vault is temporarily unavailable."
    );

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(storedState);
    expect(await db.vaultProfile.count()).toBe(1);
    expect(await db.vaultAnalytics.count()).toBe(1);

    installNativeVaultBridge({
      isVaultDeviceBoundWrapperAvailable: vi.fn().mockResolvedValue(true),
      wrapVaultRootKey: vi.fn(),
      unwrapVaultRootKey: vi.fn(
        async ({ wrappedRootKey }: { wrappedRootKey: string }) => ({
          rootKeyBase64: wrappedRootKey.replace("wrapped:", ""),
        })
      ),
    });
    clearOfflineVaultSession();

    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(
      persistedUser
    );
    await expect(listVaultAnalyticsEvents()).resolves.toEqual([
      expect.objectContaining({ sessionId: "native-session" }),
    ]);
  });
});
