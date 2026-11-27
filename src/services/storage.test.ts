// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dexie from "dexie";
import { buildEnvelopeMacPayload } from "./authStorageEnvelope";
import { authStorage } from "./storage";
import { createRecoverableLazyModuleError } from "../lib/lazyModuleErrors";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
} from "../lib/offlineVault";
import * as offlineVault from "../lib/offlineVault";
import { db } from "../lib/db";
import { getActiveOfflineVaultSession } from "../lib/offlineVaultRuntime";
import { runWithOfflineVaultLifecycleLock } from "../lib/offlineVaultLifecycleLock";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const LEGACY_AUTH_STORAGE_VERSION = 1;
const CURRENT_AUTH_STORAGE_VERSION = 2;
const LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS = 5_000;
const CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;
const textEncoder = new TextEncoder();

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function createEncryptedEnvelope(
  user: Record<string, unknown>,
  csrfToken: string,
  options: {
    version: number;
    iterations: number;
    plaintext?: string;
  }
): Promise<string> {
  const keyMaterial = `secpal-auth-storage:${csrfToken}`;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: options.iterations,
    },
    baseKey,
    AUTH_STORAGE_DERIVED_KEY_BYTES * 8
  );
  const derivedKey = new Uint8Array(derivedBits);
  const encryptionKeyBytes = derivedKey.slice(0, AUTH_STORAGE_HALF_KEY_BYTES);
  const macKeyBytes = derivedKey.slice(AUTH_STORAGE_HALF_KEY_BYTES);

  const [encryptionKey, macKey] = await Promise.all([
    crypto.subtle.importKey(
      "raw",
      encryptionKeyBytes,
      { name: "AES-CBC", length: AUTH_STORAGE_HALF_KEY_BYTES * 8 },
      false,
      ["encrypt", "decrypt"]
    ),
    crypto.subtle.importKey(
      "raw",
      macKeyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    ),
  ]);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: toArrayBuffer(iv) },
      encryptionKey,
      textEncoder.encode(options.plaintext ?? JSON.stringify(user))
    )
  );
  const envelopeWithoutMac = {
    scheme: AUTH_STORAGE_SCHEME,
    version: options.version,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  };
  const mac = await crypto.subtle.sign(
    "HMAC",
    macKey,
    textEncoder.encode(buildEnvelopeMacPayload(envelopeWithoutMac))
  );

  return JSON.stringify({
    ...envelopeWithoutMac,
    mac: encodeBase64(new Uint8Array(mac)),
  });
}

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

describe("authStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOfflineVaultSession();
    setCsrfTokenCookie("test-csrf-token");
  });

  afterEach(() => {
    clearOfflineVaultSession();
    vi.restoreAllMocks();
  });

  it("stores only wrapped vault state in localStorage and restores the encrypted profile from IndexedDB", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
      employeeStatus: "pre_contract" as const,
      onboardingWorkflowStatus: "submitted_for_review" as const,
    };

    await authStorage.setUser(user);

    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(storedVaultState).not.toBeNull();
    const parsedStoredVaultState = JSON.parse(
      storedVaultState as string
    ) as Record<string, unknown>;

    expect(parsedStoredVaultState).toEqual(
      expect.objectContaining({
        scheme: expect.any(String),
        version: expect.anything(),
        subjectHash: expect.any(String),
        wrapper: expect.objectContaining({
          kind: expect.any(String),
        }),
      })
    );
    expect(parsedStoredVaultState.subjectHash).not.toBe("");
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("keeps encrypted auth state readable when the session-derived key material changes", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    setCsrfTokenCookie("rotated-csrf-token");

    await expect(authStorage.getUser()).resolves.toEqual(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
  });

  it("preserves a vault marker when the encrypted profile is temporarily unavailable", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(user);
    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(storedVaultState).not.toBeNull();
    clearOfflineVaultSession();
    vi.spyOn(offlineVault, "readPersistedAuthUserFromVault").mockResolvedValue(
      null
    );

    await expect(authStorage.getUser()).resolves.toBeNull();

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(storedVaultState);
  });

  it("locks the offline vault without deleting encrypted records and restores them after unlock", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    await expect(authStorage.getUser()).resolves.toEqual(user);
    expect(getActiveOfflineVaultSession()).not.toBeNull();

    authStorage.lockVault();

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(authStorage.hasVaultLock()).toBe(true);
    expect(getActiveOfflineVaultSession()).toBeNull();

    await expect(authStorage.unlockVault()).resolves.toEqual({
      status: "unlocked",
      user,
    });
    expect(authStorage.hasVaultLock()).toBe(false);
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("restores the locked offline vault after the browser-session CSRF token rotates", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);

    authStorage.lockVault();
    setCsrfTokenCookie("rotated-csrf-token");

    await expect(authStorage.unlockVault()).resolves.toEqual({
      status: "unlocked",
      user,
    });
    expect(authStorage.hasVaultLock()).toBe(false);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("clears auth state when unlockVault finds no vault to unlock", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(user);
    authStorage.lockVault();
    expect(authStorage.hasVaultLock()).toBe(true);

    // Corrupt the vault state so getUser returns null after unlock
    localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);

    await expect(authStorage.unlockVault()).resolves.toEqual({
      status: "empty",
    });
    expect(authStorage.hasStoredUser()).toBe(false);
  });

  it("preserves a locked vault when its wrapper is temporarily unavailable", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(user);
    authStorage.lockVault();
    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
    vi.spyOn(offlineVault, "readPersistedAuthUserFromVault").mockResolvedValue(
      null
    );

    await expect(authStorage.unlockVault()).resolves.toEqual({
      status: "unavailable",
    });

    expect(authStorage.hasVaultLock()).toBe(true);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(storedVaultState);
    expect(await db.vaultProfile.count()).toBe(1);
  });

  it("lets a logout barrier supersede an in-flight vault unlock", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(user);
    authStorage.lockVault();
    const readStarted = createDeferredPromise<void>();
    const releaseRead = createDeferredPromise<void>();
    vi.spyOn(
      offlineVault,
      "readPersistedAuthUserFromVault"
    ).mockImplementationOnce(async () => {
      readStarted.resolve();
      await releaseRead.promise;
      return user;
    });

    const unlock = authStorage.unlockVault();
    await readStarted.promise;
    const cleanup = authStorage.clear();
    releaseRead.resolve();
    await cleanup;

    await expect(unlock).resolves.toEqual({ status: "empty" });
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    expect(authStorage.hasVaultLock()).toBe(false);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
  });

  it("reports an unexpected IndexedDB AbortError as a persistence failure", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const unexpectedAbort = new DOMException(
      "IndexedDB transaction aborted.",
      "AbortError"
    );
    vi.spyOn(offlineVault, "initializeOfflineVault").mockRejectedValueOnce(
      unexpectedAbort
    );

    await expect(
      authStorage.setUser({
        id: "1",
        name: "Test User",
        email: "test@secpal.dev",
        emailVerified: false,
      })
    ).rejects.toMatchObject({
      name: "AuthUserPersistenceError",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to persist stored user data:",
      expect.objectContaining({ name: "AuthUserPersistenceError" })
    );
  });

  it("reports an unexpected IndexedDB AbortError during vault cleanup", async () => {
    const unexpectedAbort = new DOMException(
      "IndexedDB transaction aborted.",
      "AbortError"
    );
    vi.spyOn(offlineVault, "clearOfflineVaultTables").mockRejectedValueOnce(
      unexpectedAbort
    );

    await expect(authStorage.clear()).rejects.toBe(unexpectedAbort);
  });

  it("blocks a later writer until destructive logout cleanup commits", async () => {
    const previous = {
      id: "previous-session",
      name: "Previous User",
      email: "previous@secpal.dev",
      emailVerified: true,
    };
    const next = { ...previous, id: "next-session" };
    await authStorage.setUser(previous);
    const cleanup = vi
      .spyOn(db.vaultProfile, "clear")
      .mockRejectedValueOnce(new Error("Synthetic cleanup rollback"));
    await authStorage.clear().catch(() => undefined);
    expect(authStorage.hasLogoutBarrier()).toBe(true);

    await expect(authStorage.setUser(next)).rejects.toMatchObject({
      name: "AuthUserPersistenceError",
    });
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    cleanup.mockRestore();
    await authStorage.clear();
    await expect(authStorage.setUser(next)).resolves.toEqual({
      status: "persisted",
    });
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("discards a restored profile when a newer writer replaces the vault during the read", async () => {
    const previous = {
      id: "previous-restore",
      name: "Previous User",
      email: "previous@secpal.dev",
      emailVerified: true,
    };
    const next = { ...previous, id: "next-restore" };
    await authStorage.setUser(previous);
    const started = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    vi.spyOn(
      await import("../lib/offlineVault"),
      "readPersistedAuthUserFromVault"
    ).mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      return previous;
    });
    const restore = authStorage.getUser();
    await started.promise;
    await authStorage.setUser(next);
    release.resolve();

    await expect(restore).resolves.toBeNull();
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("keeps a newer vault lock when a preceding unlock finishes late", async () => {
    const user = {
      id: "late-unlock",
      name: "Test User",
      email: "locked@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(user);
    authStorage.lockVault();
    const started = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    vi.spyOn(
      await import("../lib/offlineVault"),
      "readPersistedAuthUserFromVault"
    ).mockImplementationOnce(async () => {
      started.resolve();
      await release.promise;
      return user;
    });
    const unlock = authStorage.unlockVault();
    await started.promise;
    authStorage.lockVault();
    release.resolve();

    await expect(unlock).resolves.not.toMatchObject({ status: "unlocked" });
    expect(authStorage.hasVaultLock()).toBe(true);
  });

  it("does not clear a logout barrier raised during persistence", async () => {
    const persistenceStarted = createDeferredPromise<void>();
    const releasePersistence = createDeferredPromise<void>();
    let persistenceSignal: AbortSignal | undefined;
    vi.spyOn(offlineVault, "initializeOfflineVault").mockImplementationOnce(
      async (_user, options) => {
        persistenceSignal = options?.signal;
        persistenceStarted.resolve();
        await releasePersistence.promise;

        if (persistenceSignal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
      }
    );

    const persistence = authStorage.setUser({
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    });
    await persistenceStarted.promise;
    const cleanup = authStorage.clear();
    expect(persistenceSignal?.aborted).toBe(true);
    releasePersistence.resolve();

    await expect(persistence).resolves.toEqual({ status: "superseded" });
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    await cleanup;
  });

  it("rolls back vault records when another tab logs out during persistence", async () => {
    const profileWritten = createDeferredPromise<void>();
    const releaseProfileWrite = createDeferredPromise<void>();
    const originalPut = db.vaultProfile.put.bind(db.vaultProfile);
    let attemptedProfile: Parameters<typeof originalPut>[0] | null = null;
    vi.spyOn(db.vaultProfile, "put").mockImplementationOnce((...args) => {
      [attemptedProfile] = args;
      return originalPut(...args).then((result) => {
        profileWritten.resolve();
        return Dexie.waitFor(releaseProfileWrite.promise).then(() => result);
      });
    });

    const persistence = authStorage.setUser({
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    });
    await profileWritten.promise;
    localStorage.setItem("auth_logout_barrier", "other-context");
    releaseProfileWrite.resolve();

    await expect(persistence).resolves.toEqual({ status: "superseded" });
    expect(attemptedProfile).not.toBeNull();
    expect(await db.vaultProfile.get("profile")).not.toEqual(attemptedProfile);
    expect(authStorage.hasLogoutBarrier()).toBe(true);
  });

  it("does not let a stale writer abort newer active persistence", async () => {
    const newerPersistenceStarted = createDeferredPromise<void>();
    const releaseNewerPersistence = createDeferredPromise<void>();
    const originalInitializeOfflineVault = offlineVault.initializeOfflineVault;
    vi.spyOn(offlineVault, "initializeOfflineVault").mockImplementationOnce(
      async (user, options) => {
        newerPersistenceStarted.resolve();
        await releaseNewerPersistence.promise;
        await originalInitializeOfflineVault(user, options);
      }
    );
    const newerPersistence = authStorage.setUser({
      id: "newer-user",
      name: "Newer User",
      email: "newer@secpal.dev",
      emailVerified: true,
    });

    await newerPersistenceStarted.promise;
    const stalePersistence = authStorage.setUser(
      {
        id: "stale-user",
        name: "Stale User",
        email: "stale@secpal.dev",
        emailVerified: true,
      },
      { shouldCommit: () => false }
    );

    await expect(stalePersistence).resolves.toEqual({
      status: "superseded",
    });
    releaseNewerPersistence.resolve();
    await expect(newerPersistence).resolves.toEqual({ status: "persisted" });
    await expect(authStorage.getUser()).resolves.toEqual({
      id: "newer-user",
      name: "Newer User",
      email: "newer@secpal.dev",
      emailVerified: true,
    });
  });

  it("migrates the legacy auth_user envelope into the encrypted vault and removes auth_user from localStorage", async () => {
    const legacyUser = {
      id: "1",
      name: "Legacy User",
      email: "legacy@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem(
      "auth_user",
      await createEncryptedEnvelope(legacyUser, "test-csrf-token", {
        version: CURRENT_AUTH_STORAGE_VERSION,
        iterations: CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS,
      })
    );

    await expect(authStorage.getUser()).resolves.toEqual(legacyUser);
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
  });

  it("preserves legacy auth_user when vault initialization fails with a recoverable lazy chunk error", async () => {
    const legacyUser = {
      id: "1",
      name: "Legacy User",
      email: "legacy@secpal.dev",
      emailVerified: false,
    };
    const initializeOfflineVaultSpy = vi
      .spyOn(offlineVault, "initializeOfflineVault")
      .mockRejectedValueOnce(
        createRecoverableLazyModuleError(
          "Stored offline auth data is temporarily unavailable on this device.",
          new TypeError("Failed to fetch dynamically imported module")
        )
      );

    try {
      localStorage.setItem(
        "auth_user",
        await createEncryptedEnvelope(legacyUser, "test-csrf-token", {
          version: CURRENT_AUTH_STORAGE_VERSION,
          iterations: CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS,
        })
      );

      await expect(authStorage.getUser()).rejects.toMatchObject({
        code: "RECOVERABLE_LAZY_MODULE_ERROR",
      });
      expect(localStorage.getItem("auth_user")).not.toBeNull();
      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    } finally {
      initializeOfflineVaultSpy.mockRestore();
    }
  });

  it("purges orphaned vault and legacy rows when legacy auth migration fails", async () => {
    const legacyUser = {
      id: "1",
      name: "Legacy User",
      email: "legacy@secpal.dev",
      emailVerified: false,
    };
    const migrationFailure = new Error("Simulated vault migration failure");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const initializeOfflineVaultSpy = vi
      .spyOn(offlineVault, "initializeOfflineVault")
      .mockImplementationOnce(async () => {
        await db.vaultProfile.put({
          id: "profile",
          recordId: "profile",
          version: 1,
          ciphertext: "orphaned-profile",
          iv: "orphaned-iv",
          authTag: "orphaned-tag",
        });
        await db.analytics.add({
          type: "page_view",
          category: "navigation",
          action: "view_dashboard",
          timestamp: Date.now(),
          synced: false,
          sessionId: "legacy-session",
          userId: legacyUser.id,
        });
        throw migrationFailure;
      });

    try {
      localStorage.setItem(
        "auth_user",
        await createEncryptedEnvelope(legacyUser, "test-csrf-token", {
          version: CURRENT_AUTH_STORAGE_VERSION,
          iterations: CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS,
        })
      );

      await expect(authStorage.getUser()).resolves.toBeNull();

      expect(localStorage.getItem("auth_user")).toBeNull();
      expect(await db.vaultProfile.count()).toBe(0);
      expect(await db.analytics.count()).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to parse stored user data:",
        migrationFailure
      );
    } finally {
      initializeOfflineVaultSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it("clears invalid JSON persisted auth state while decrypting", async () => {
    const lockRequestSpy = vi.spyOn(navigator.locks, "request");
    localStorage.setItem("auth_user", "invalid-json");

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(lockRequestSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears encrypted auth state when the decrypted payload is not valid JSON", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await authStorage.setUser(user);
    await expect(authStorage.getUser()).resolves.toEqual(user);

    vi.spyOn(globalThis.crypto.subtle, "decrypt").mockResolvedValue(
      new TextEncoder().encode("not-json").buffer
    );

    await expect(authStorage.getUser()).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse stored user data:",
      expect.any(SyntaxError)
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears legacy encrypted auth state when the decrypted payload is not valid JSON", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    localStorage.setItem(
      "auth_user",
      await createEncryptedEnvelope({}, "test-csrf-token", {
        version: CURRENT_AUTH_STORAGE_VERSION,
        iterations: CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS,
        plaintext: "not-json",
      })
    );

    await expect(authStorage.getUser()).resolves.toBeNull();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse stored user data:",
      expect.any(SyntaxError)
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears persisted auth state when WebCrypto rejects during setUser", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const cryptoFailure = new DOMException(
      "The operation failed.",
      "OperationError"
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    localStorage.setItem("auth_user", "stale-auth-storage-record");

    vi.spyOn(globalThis.crypto.subtle, "deriveBits").mockRejectedValue(
      cryptoFailure
    );

    await expect(authStorage.setUser(user)).rejects.toMatchObject({
      name: "AuthUserPersistenceError",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to persist stored user data:",
      expect.objectContaining({ name: "AuthUserPersistenceError" })
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("rejects a logout barrier without matching cleanup evidence", async () => {
    localStorage.setItem("auth_logout_barrier", "unconfirmed-logout");
    const initialize = vi.spyOn(offlineVault, "initializeOfflineVault");
    await expect(
      authStorage.setUser({
        id: "1",
        name: "Test User",
        email: "test@secpal.dev",
        emailVerified: false,
      })
    ).rejects.toMatchObject({ name: "AuthUserPersistenceError" });
    expect(initialize).not.toHaveBeenCalled();
    expect(authStorage.hasLogoutBarrier()).toBe(true);
  });

  it("waits for the destructive transaction before permitting a newer login", async () => {
    const previous = {
      id: "cleanup-previous",
      name: "Previous User",
      email: "previous@secpal.dev",
      emailVerified: true,
    };
    const next = { ...previous, id: "cleanup-next" };
    await authStorage.setUser(previous);
    const started = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    const originalClear = db.vaultProfile.clear.bind(db.vaultProfile);
    vi.spyOn(db.vaultProfile, "clear").mockImplementationOnce(() => {
      started.resolve();
      return Dexie.waitFor(release.promise.then(originalClear)) as ReturnType<
        typeof db.vaultProfile.clear
      >;
    });
    const initialize = vi.spyOn(offlineVault, "initializeOfflineVault");
    const cleanup = authStorage.clear();
    await started.promise;
    const login = authStorage.setUser(next);

    try {
      await Promise.resolve();
      expect(initialize).not.toHaveBeenCalled();
      expect(authStorage.hasLogoutBarrier()).toBe(true);
    } finally {
      release.resolve();
    }
    await cleanup;
    await expect(login).resolves.toEqual({ status: "persisted" });
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("keeps user revalidation required until confirmed persistence is completed", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(storedUser);
    const revalidationOwnerToken = authStorage.requireUserRevalidation();

    await authStorage.setUser(confirmedUser);

    expect(localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)).toBe(
      revalidationOwnerToken
    );
    expect(authStorage.hasStoredUser()).toBe(false);
    await expect(authStorage.getUser()).resolves.toBeNull();

    authStorage.completeUserRevalidation(revalidationOwnerToken);

    expect(authStorage.hasStoredUser()).toBe(true);
    await expect(authStorage.getUser()).resolves.toEqual(confirmedUser);
  });

  it("reuses an active revalidation owner and fences a later lifecycle", () => {
    const ownerToken = authStorage.requireUserRevalidation();

    expect(authStorage.requireUserRevalidation()).toBe(ownerToken);

    authStorage.completeUserRevalidation(ownerToken);
    const newerOwnerToken = authStorage.requireUserRevalidation();

    expect(newerOwnerToken).not.toBe(ownerToken);

    authStorage.completeUserRevalidation(ownerToken);

    expect(localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)).toBe(
      newerOwnerToken
    );
    expect(authStorage.hasStoredUser()).toBe(false);

    authStorage.completeUserRevalidation(newerOwnerToken);

    expect(
      localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)
    ).toBeNull();
  });

  it("creates revalidation owner tokens when randomUUID is unavailable", () => {
    const originalCrypto = Object.getOwnPropertyDescriptor(
      globalThis,
      "crypto"
    );
    const getRandomValues = vi.fn((values: Uint8Array) => {
      values.fill(0x2a);
      return values;
    });

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        ...crypto,
        getRandomValues,
        randomUUID: undefined,
      } as unknown as Crypto,
    });

    try {
      const ownerToken = authStorage.requireUserRevalidation();

      expect(getRandomValues).toHaveBeenCalledTimes(1);
      expect(ownerToken).toMatch(/^[0-9a-f]{32}$/);
      expect(localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)).toBe(
        ownerToken
      );
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, "crypto", originalCrypto);
      }
    }
  });

  it("does not make a logout-barrier read start destructive cleanup", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

    try {
      await authStorage.setUser(user);
      localStorage.setItem("auth_logout_barrier", "1");

      await expect(authStorage.getUser()).resolves.toBeNull();

      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
      expect(vaultProfileClearSpy).not.toHaveBeenCalled();
    } finally {
      vaultProfileClearSpy.mockRestore();
    }
  });

  it("clears persisted auth state when setUser receives an invalid user", async () => {
    localStorage.setItem("auth_user", "stale-auth-storage-record");

    await expect(
      authStorage.setUser({ email: "missing-id@secpal.dev" } as never)
    ).rejects.toMatchObject({ name: "AuthUserPersistenceError" });

    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("purges orphaned vault artifacts before dropping an invalid legacy marker", async () => {
    const unsupportedStoredUser =
      '{"id":"1","name":"Legacy User","email":"legacy@secpal.dev","emailVerified":false}';

    await Promise.all([
      db.vaultProfile.put({
        id: "profile",
        recordId: "profile",
        version: 1,
        ciphertext: "orphaned-profile",
        iv: "orphaned-iv",
        authTag: "orphaned-tag",
      }),
      db.vaultAnalytics.add({
        recordId: "analytics:1",
        version: 1,
        ciphertext: "orphaned-analytics",
        iv: "orphaned-iv",
        authTag: "orphaned-tag",
        synced: false,
        timestamp: Date.now(),
      }),
      db.vaultOrganizationalUnitCache.put({
        id: "orphaned-unit",
        recordId: "organizational-unit:orphaned-unit",
        version: 1,
        ciphertext: "orphaned-unit",
        iv: "orphaned-iv",
        authTag: "orphaned-tag",
        cachedAt: new Date(),
        lastSynced: new Date(),
      }),
    ]);
    localStorage.setItem("auth_user", unsupportedStoredUser);

    expect(localStorage.getItem("auth_user")).toBe(unsupportedStoredUser);
    expect(await db.vaultProfile.count()).toBe(1);
    expect(await db.vaultAnalytics.count()).toBe(1);
    expect(await db.vaultOrganizationalUnitCache.count()).toBe(1);

    await expect(authStorage.getUser()).resolves.toBeNull();

    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
    expect(await db.vaultAnalytics.count()).toBe(0);
    expect(await db.vaultOrganizationalUnitCache.count()).toBe(0);
  });

  it("does not clear a replacement vault when queued cleanup loses ownership", async () => {
    const next = {
      id: "replacement-while-queued",
      name: "Next User",
      email: "next@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(next);
    const vault = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
    expect(vault).not.toBeNull();
    const held = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    const queued = createDeferredPromise<void>();
    const request = navigator.locks.request.bind(navigator.locks);
    const newerLogin = runWithOfflineVaultLifecycleLock(async () => {
      held.resolve();
      await release.promise;
      localStorage.setItem(AUTH_VAULT_STORAGE_KEY, vault!);
      localStorage.removeItem("auth_logout_barrier");
    });
    await held.promise;
    vi.spyOn(navigator.locks, "request").mockImplementationOnce(
      (name, options, callback) => {
        queued.resolve();
        return request(name, options, callback);
      }
    );

    const cleanup = authStorage.clear();
    try {
      await queued.promise;
      expect(await db.vaultProfile.count()).toBe(1);
    } finally {
      release.resolve();
      await Promise.all([newerLogin, cleanup]);
    }
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("publishes the finished vault and retires the logout barrier under one lock", async () => {
    await authStorage.clear();
    const request = navigator.locks.request.bind(navigator.locks);
    let barrierWhenLoginReleased: boolean | undefined;
    const lock = vi
      .spyOn(navigator.locks, "request")
      .mockImplementationOnce((name, options, callback) =>
        request(name, options, async (heldLock) => {
          const result = await callback(heldLock);
          barrierWhenLoginReleased = authStorage.hasLogoutBarrier();
          return result;
        })
      );
    try {
      await expect(
        authStorage.setUser({
          id: "next-user",
          name: "Next User",
          email: "next-user@secpal.dev",
          emailVerified: true,
        })
      ).resolves.toEqual({ status: "persisted" });
      expect(barrierWhenLoginReleased).toBe(false);
    } finally {
      lock.mockRestore();
    }
  });

  it("does not let invalid legacy cleanup erase a newer login", async () => {
    const nextUser = {
      id: "next-user",
      name: "Next User",
      email: "next-user@secpal.dev",
      emailVerified: true,
    };
    await expect(authStorage.setUser(nextUser)).resolves.toEqual({
      status: "persisted",
    });
    const nextVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
    const nextProfile = await db.vaultProfile.get("profile");

    if (!nextVaultState || !nextProfile) {
      throw new Error("Expected a complete replacement vault.");
    }

    await db.vaultProfile.clear();
    localStorage.clear();
    clearOfflineVaultSession();
    localStorage.setItem("auth_user", "invalid-json");
    const releaseNewLogin = createDeferredPromise<void>();
    const newLoginLockAcquired = createDeferredPromise<void>();
    const lockRequestSpy = vi.spyOn(navigator.locks, "request");
    const newLogin = runWithOfflineVaultLifecycleLock(async () => {
      newLoginLockAcquired.resolve();
      await releaseNewLogin.promise;
      localStorage.removeItem("auth_user");
      localStorage.setItem(AUTH_VAULT_STORAGE_KEY, nextVaultState);
      await db.vaultProfile.put(nextProfile);
    });

    await newLoginLockAcquired.promise;
    const invalidRead = authStorage.getUser();

    try {
      await vi.waitFor(() => {
        expect(lockRequestSpy).toHaveBeenCalledTimes(2);
      });
    } finally {
      releaseNewLogin.resolve();
      await Promise.allSettled([newLogin, invalidRead]);
    }

    await expect(invalidRead).resolves.toBeNull();

    await expect(authStorage.getUser()).resolves.toEqual(nextUser);
  });

  it.each([
    ["invalid JSON", "{not-valid-json"],
    ["an unsupported envelope", "{}"],
  ])(
    "does not let %s parsing erase a replacement login",
    async (_description, malformedVaultState) => {
      const nextUser = {
        id: "next-user",
        name: "Next User",
        email: "next-user@secpal.dev",
        emailVerified: true,
      };
      await expect(authStorage.setUser(nextUser)).resolves.toEqual({
        status: "persisted",
      });
      const nextVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
      const nextProfile = await db.vaultProfile.get("profile");

      if (!nextVaultState || !nextProfile) {
        throw new Error("Expected a complete replacement vault.");
      }

      localStorage.setItem(AUTH_VAULT_STORAGE_KEY, malformedVaultState);
      clearOfflineVaultSession();
      const originalParse = JSON.parse;
      let replacementCommitted = false;
      const parseSpy = vi
        .spyOn(JSON, "parse")
        .mockImplementation((serializedValue: string) => {
          if (
            serializedValue === malformedVaultState &&
            !replacementCommitted
          ) {
            replacementCommitted = true;
            localStorage.setItem(AUTH_VAULT_STORAGE_KEY, nextVaultState);
          }

          return originalParse(serializedValue);
        });

      try {
        await expect(authStorage.getUser()).resolves.toBeNull();
      } finally {
        parseSpy.mockRestore();
      }

      expect(replacementCommitted).toBe(true);
      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(nextVaultState);
      expect(await db.vaultProfile.get("profile")).toEqual(nextProfile);
      await expect(authStorage.getUser()).resolves.toEqual(nextUser);
    }
  );

  it("clears unsupported unencrypted persisted auth state", async () => {
    const unsupportedStoredUser =
      '{"id":"1","name":"Legacy User","email":"legacy@secpal.dev","emailVerified":false}';

    localStorage.setItem("auth_user", unsupportedStoredUser);

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears unsupported legacy encrypted auth state after the format upgrade", async () => {
    const legacyUser = {
      id: "1",
      name: "Legacy Encrypted User",
      email: "legacy-encrypted@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem(
      "auth_user",
      await createEncryptedEnvelope(legacyUser, "test-csrf-token", {
        version: LEGACY_AUTH_STORAGE_VERSION,
        iterations: LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS,
      })
    );

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("admits a cross-tab writer after matching destructive cleanup commits", async () => {
    const previous = {
      id: "previous-tab",
      name: "Previous User",
      email: "previous@secpal.dev",
      emailVerified: true,
    };
    const next = { ...previous, id: "next-tab" };
    await authStorage.setUser(previous);
    const owner = "separate-tab-logout";
    const receipt = `auth_logout_cleanup:${owner}`;
    localStorage.setItem("auth_logout_barrier", owner);
    localStorage.setItem(receipt, "pending");
    const initialize = vi.spyOn(offlineVault, "initializeOfflineVault");
    const login = authStorage.setUser(next);
    await Promise.resolve();
    expect(initialize).not.toHaveBeenCalled();

    await runWithOfflineVaultLifecycleLock(async (signal) => {
      await offlineVault.clearOfflineVaultTables({ signal });
      localStorage.setItem(receipt, "committed");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: receipt,
          newValue: "committed",
          storageArea: localStorage,
        })
      );
    });

    await expect(login).resolves.toEqual({ status: "persisted" });
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("fences login while the prior browser subscription is being deactivated", async () => {
    const next = {
      id: "after-push-deactivation",
      name: "Next User",
      email: "next@secpal.dev",
      emailVerified: true,
    };
    const started = createDeferredPromise<void>();
    const deactivated = createDeferredPromise<boolean>();
    const unsubscribe = vi.fn(() => {
      started.resolve();
      return deactivated.promise;
    });
    const registration = {
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue({ unsubscribe }),
      },
    };
    const original = Object.getOwnPropertyDescriptor(
      navigator,
      "serviceWorker"
    );
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistration: vi.fn().mockResolvedValue(registration) },
    });
    const lock = vi.spyOn(navigator.locks, "request");
    const logout = authStorage.clear({ sensitive: true });
    let login: ReturnType<typeof authStorage.setUser> | undefined;
    try {
      await expect(
        Promise.race([
          started.promise.then(() => "deactivation-started"),
          logout.then(() => "cleanup-committed"),
        ])
      ).resolves.toBe("deactivation-started");
      expect(lock).not.toHaveBeenCalled();

      login = authStorage.setUser(next);
      await Promise.resolve();
      expect(authStorage.hasLogoutBarrier()).toBe(true);
      expect(lock).not.toHaveBeenCalled();

      deactivated.resolve(true);
      await expect(logout).resolves.toBeUndefined();
      await expect(login).resolves.toEqual({ status: "persisted" });
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      deactivated.resolve(true);
      await Promise.allSettled([login, logout]);
      if (original) {
        Object.defineProperty(navigator, "serviceWorker", original);
      } else {
        Reflect.deleteProperty(navigator, "serviceWorker");
      }
    }
  });

  it("keeps a stalled browser-push cleanup blocked and ignores late lookup", async () => {
    const lookup = createDeferredPromise<PushSubscription | null>();
    const started = createDeferredPromise<void>();
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const lookupSubscription = vi.fn(() => {
      started.resolve();
      return lookup.promise;
    });
    const original = Object.getOwnPropertyDescriptor(
      navigator,
      "serviceWorker"
    );
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistration: vi.fn().mockResolvedValue({
          pushManager: { getSubscription: lookupSubscription },
        }),
      },
    });
    vi.useFakeTimers();
    const logout = authStorage
      .clear({ sensitive: true })
      .catch((error: unknown) => error);
    try {
      await started.promise;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await logout).toMatchObject({ name: "TimeoutError" });
      lookup.resolve({ unsubscribe } as unknown as PushSubscription);
      await Promise.resolve();
      expect(unsubscribe).not.toHaveBeenCalled();
      expect(authStorage.hasLogoutBarrier()).toBe(true);
      await expect(
        authStorage.setUser({
          id: "blocked-by-push-timeout",
          name: "Next User",
          email: "next@secpal.dev",
          emailVerified: true,
        })
      ).rejects.toMatchObject({ name: "AuthUserPersistenceError" });
    } finally {
      lookup.resolve(null);
      await logout;
      vi.useRealTimers();
      if (original) {
        Object.defineProperty(navigator, "serviceWorker", original);
      } else {
        Reflect.deleteProperty(navigator, "serviceWorker");
      }
    }
  });

  it("keeps a failed full logout blocked until its destructive scope is cleared", async () => {
    const next = {
      id: "after-full-logout",
      name: "Next User",
      email: "next@secpal.dev",
      emailVerified: true,
    };
    const transaction = vi
      .spyOn(db, "transaction")
      .mockRejectedValueOnce(new Error("Full cleanup was interrupted"));
    localStorage.setItem("secpal-notification-preferences", "{}");
    await expect(authStorage.clear({ sensitive: true })).rejects.toThrow(
      "Full cleanup was interrupted"
    );

    localStorage.setItem("auth_logout_barrier", "remote-vault-only");
    localStorage.setItem("auth_logout_cleanup:remote-vault-only", "committed");
    await expect(authStorage.setUser(next)).rejects.toMatchObject({
      name: "AuthUserPersistenceError",
    });

    await authStorage.clear();
    expect(transaction).toHaveBeenCalledTimes(2);
    await expect(authStorage.setUser(next)).resolves.toEqual({
      status: "persisted",
    });
  });

  it("preserves a newer cross-tab logout published during barrier retirement", async () => {
    await authStorage.clear();
    const previous = localStorage.getItem("auth_logout_barrier");
    const next = {
      id: "interrupted-barrier-retirement",
      name: "Next User",
      email: "next@secpal.dev",
      emailVerified: true,
    };
    const publishRemoteLogout = () => {
      localStorage.setItem("auth_logout_barrier", "new-remote-barrier");
      localStorage.setItem("auth_logout_cleanup:new-remote-barrier", "pending");
    };
    const removeItem = Storage.prototype.removeItem;
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (this === localStorage && key === "auth_logout_barrier") {
        publishRemoteLogout();
      }
      removeItem.call(this, key);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (
        this === localStorage &&
        key === `auth_logout_cleanup:${previous}` &&
        value === "retired"
      ) {
        publishRemoteLogout();
      }
      setItem.call(this, key, value);
    });

    await expect(authStorage.setUser(next)).resolves.toEqual({
      status: "superseded",
    });
    expect(localStorage.getItem("auth_logout_barrier")).toBe(
      "new-remote-barrier"
    );
    await expect(authStorage.getUser()).resolves.toBeNull();
  });

  it("allows login after cleanup while trailing work is still unresolved", async () => {
    const started = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    let continued: boolean | undefined;
    const logout = authStorage.clear({
      trailing: async (isCurrent) => {
        started.resolve();
        await release.promise;
        continued = isCurrent();
      },
    });
    await started.promise;
    try {
      await expect(
        authStorage.setUser({
          id: "next-with-trailing",
          name: "Next User",
          email: "next@secpal.dev",
          emailVerified: true,
        })
      ).resolves.toEqual({ status: "persisted" });
      expect(continued).toBeUndefined();
    } finally {
      release.resolve();
      await logout;
    }
    expect(continued).toBe(false);
  });

  it("blocks a timed-out cleanup and fences delayed IndexedDB work after recovery", async () => {
    const previous = {
      id: "late-indexeddb-cleanup",
      name: "Previous User",
      email: "previous@secpal.dev",
      emailVerified: true,
    };
    const next = { ...previous, id: "recovered-after-timeout" };
    await authStorage.setUser(previous);
    const entered = createDeferredPromise<void>();
    const release = createDeferredPromise<void>();
    const settled = createDeferredPromise<void>();
    const vault = await import("../lib/offlineVault");
    const actual = vault.clearOfflineVaultTables;
    vi.spyOn(vault, "clearOfflineVaultTables").mockImplementationOnce(
      async (options) => {
        entered.resolve();
        try {
          await release.promise;
          await actual(options);
        } finally {
          settled.resolve();
        }
      }
    );
    vi.useFakeTimers();
    const cleanup = authStorage.clear().catch((error: unknown) => error);
    try {
      await entered.promise;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await cleanup).toMatchObject({ name: "TimeoutError" });
      expect(authStorage.hasLogoutBarrier()).toBe(true);
      await expect(authStorage.setUser(next)).rejects.toMatchObject({
        name: "AuthUserPersistenceError",
      });
      vi.useRealTimers();
      await authStorage.clear();
      await expect(authStorage.setUser(next)).resolves.toEqual({
        status: "persisted",
      });
    } finally {
      release.resolve();
      await settled.promise;
      vi.useRealTimers();
    }
    await expect(authStorage.getUser()).resolves.toEqual(next);
  });

  it("waits for the vault cleanup module before reserving the lifecycle lock", async () => {
    const moduleLoadStarted = createDeferredPromise<void>();
    const releaseModuleLoad = createDeferredPromise<typeof offlineVault>();
    vi.resetModules();
    vi.doMock("../lib/offlineVault", () => {
      moduleLoadStarted.resolve();
      return releaseModuleLoad.promise;
    });
    const lockRequest = vi.spyOn(navigator.locks, "request");
    const { authStorage: isolatedAuthStorage } = await import("./storage");
    const cleanup = isolatedAuthStorage.clear();
    try {
      await moduleLoadStarted.promise;
      expect(lockRequest).not.toHaveBeenCalled();
    } finally {
      releaseModuleLoad.resolve(offlineVault);
      await Promise.allSettled([cleanup]);
      vi.doUnmock("../lib/offlineVault");
      vi.resetModules();
    }
  });

  it("aborts invalid stored-user cleanup while the offline vault module is still loading", async () => {
    const moduleLoadStarted = createDeferredPromise<void>();
    const releaseModuleLoad = createDeferredPromise<typeof offlineVault>();

    localStorage.setItem("auth_user", "not-json");
    vi.resetModules();
    vi.doMock("../lib/offlineVault", () => {
      moduleLoadStarted.resolve();
      return releaseModuleLoad.promise;
    });

    const { authStorage: isolatedAuthStorage } = await import("./storage");
    const controller = new AbortController();
    const read = isolatedAuthStorage.getUser({ signal: controller.signal });

    try {
      await moduleLoadStarted.promise;
      controller.abort();
      await expect(read).rejects.toMatchObject({ name: "AbortError" });
    } finally {
      releaseModuleLoad.resolve(offlineVault);
      await Promise.allSettled([read]);
      vi.doUnmock("../lib/offlineVault");
      vi.resetModules();
    }
  });
});
