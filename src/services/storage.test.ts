// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const LEGACY_AUTH_STORAGE_VERSION = 1;
const CURRENT_AUTH_STORAGE_VERSION = 2;
const LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS = 5_000;
const CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;
const textEncoder = new TextEncoder();
const SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX =
  "auth_logout_skip_vault_table_cleanup_owner:";

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function getSensitiveLogoutCleanupOwnerKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) =>
    localStorage.key(index)
  ).filter(
    (storageKey): storageKey is string =>
      storageKey?.startsWith(SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX) ?? false
  );
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
    const storedVaultState = JSON.stringify({
      scheme: "secpal-auth-vault",
      version: 2,
    });
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, storedVaultState);
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
    const cleanupOwnerToken = authStorage.beginSensitiveLogoutBarrierCleanup();
    releaseRead.resolve();

    await expect(unlock).resolves.toEqual({ status: "empty" });
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    expect(authStorage.hasVaultLock()).toBe(false);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    authStorage.endSensitiveLogoutBarrierCleanup(cleanupOwnerToken);
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

    await expect(authStorage.removeUser()).rejects.toBe(unexpectedAbort);
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
    const cleanupOwnerToken = authStorage.beginSensitiveLogoutBarrierCleanup();
    expect(persistenceSignal?.aborted).toBe(true);
    releasePersistence.resolve();

    await expect(persistence).resolves.toEqual({ status: "superseded" });
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    authStorage.endSensitiveLogoutBarrierCleanup(cleanupOwnerToken);
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
    localStorage.setItem("auth_user", "invalid-json");

    await expect(authStorage.getUser()).resolves.toBeNull();
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

  it("skips vault table cleanup when setUser fails after a full logout barrier is raised", async () => {
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
    const vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

    localStorage.setItem("auth_logout_barrier", "1");
    authStorage.setSkipBarrierVaultTableCleanup(true);
    vi.spyOn(globalThis.crypto.subtle, "deriveBits").mockRejectedValueOnce(
      cryptoFailure
    );

    await expect(authStorage.setUser(user)).rejects.toMatchObject({
      name: "AuthUserPersistenceError",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to persist stored user data:",
      expect.objectContaining({ name: "AuthUserPersistenceError" })
    );
    expect(vaultProfileClearSpy).not.toHaveBeenCalled();
  });

  it("aborts an in-flight logout transaction before persisting a newer login", async () => {
    const currentUser = {
      id: "current-user",
      name: "Current User",
      email: "current-user@secpal.dev",
      emailVerified: true,
    };
    const nextUser = {
      id: "next-user",
      name: "Next User",
      email: "next-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(currentUser);
    const releaseCleanup = createDeferredPromise<void>();
    const profileClearSpy = vi
      .spyOn(db.vaultProfile, "clear")
      .mockImplementationOnce(
        () =>
          Dexie.waitFor(releaseCleanup.promise) as ReturnType<
            typeof db.vaultProfile.clear
          >
      );
    const cleanup = authStorage.clear({ clearOfflineVaultTables: true });

    try {
      await vi.waitFor(() => {
        expect(profileClearSpy).toHaveBeenCalledTimes(1);
      });

      await expect(authStorage.setUser(nextUser)).resolves.toEqual({
        status: "persisted",
      });
      await expect(authStorage.getUser()).resolves.toEqual(nextUser);
    } finally {
      releaseCleanup.resolve();
      await Promise.allSettled([cleanup]);
    }
  });

  it("preserves the skip marker when setUser clears the logout barrier", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_logout_barrier", "1");
    authStorage.setSkipBarrierVaultTableCleanup(true);

    await expect(authStorage.setUser(user)).resolves.toEqual({
      status: "persisted",
    });

    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
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

  it("does not let invalid legacy cleanup erase a newer login", async () => {
    const nextUser = {
      id: "next-user",
      name: "Next User",
      email: "next-user@secpal.dev",
      emailVerified: true,
    };
    const releaseInvalidCleanup = createDeferredPromise<void>();
    const originalClearInvalidOfflineVaultArtifacts =
      offlineVault.clearInvalidOfflineVaultArtifacts;
    const clearInvalidArtifactsSpy = vi
      .spyOn(offlineVault, "clearInvalidOfflineVaultArtifacts")
      .mockImplementationOnce(async (options) => {
        await releaseInvalidCleanup.promise;
        await originalClearInvalidOfflineVaultArtifacts(options);
      });
    localStorage.setItem("auth_user", "invalid-json");
    const invalidRead = authStorage.getUser();

    try {
      await vi.waitFor(() => {
        expect(clearInvalidArtifactsSpy).toHaveBeenCalledTimes(1);
      });

      await expect(authStorage.setUser(nextUser)).resolves.toEqual({
        status: "persisted",
      });
    } finally {
      releaseInvalidCleanup.resolve();
      await Promise.allSettled([invalidRead]);
    }

    await expect(invalidRead).resolves.toBeNull();

    await expect(authStorage.getUser()).resolves.toEqual(nextUser);
  });

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

  it("waits for vault IndexedDB cleanup before removeUser resolves", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);

    await authStorage.removeUser();

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
  });

  it("can clear auth markers without clearing vault tables", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);

    try {
      await authStorage.clear({ clearOfflineVaultTables: false });

      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
      expect(await db.vaultProfile.count()).toBe(1);
    } finally {
      await db.vaultProfile.clear();
    }
  });

  it("preserves an existing skip marker when clear runs during an active logout barrier", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);

    localStorage.setItem("auth_logout_barrier", "1");
    authStorage.setSkipBarrierVaultTableCleanup(true);

    await authStorage.clear();

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
    expect(await db.vaultProfile.count()).toBe(1);
  });

  it("resets stale sensitive logout cleanup owners when a new full logout starts after re-login", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);

    const staleOwnerToken = "closed-context";
    localStorage.setItem("auth_logout_barrier", "stale-barrier");
    localStorage.setItem("auth_logout_skip_vault_table_cleanup", "1");
    localStorage.setItem(
      `${SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX}${staleOwnerToken}`,
      "1"
    );

    expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(1);

    await authStorage.setUser(user);

    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(1);

    const refreshedOwnerToken =
      authStorage.beginSensitiveLogoutBarrierCleanup();
    authStorage.endSensitiveLogoutBarrierCleanup(refreshedOwnerToken);

    expect(
      localStorage.getItem("auth_logout_skip_vault_table_cleanup")
    ).toBeNull();
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(0);

    // The stale owner token from the previous barrier must no longer be able to
    // influence the refreshed logout lifecycle.
    authStorage.endSensitiveLogoutBarrierCleanup(staleOwnerToken);
    expect(
      localStorage.getItem("auth_logout_skip_vault_table_cleanup")
    ).toBeNull();
  });

  it("keeps the skip marker while another tab still owns sensitive logout cleanup", () => {
    const ownerToken = authStorage.beginSensitiveLogoutBarrierCleanup();
    localStorage.setItem(
      `${SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX}other-tab`,
      String(Date.now())
    );

    authStorage.endSensitiveLogoutBarrierCleanup(ownerToken);

    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
  });

  it("waits for cross-tab destructive logout cleanup before persisting a new user", async () => {
    const cleanupOwnerToken = authStorage.beginSensitiveLogoutBarrierCleanup();
    const cleanupLockAcquired = createDeferredPromise<void>();
    const releaseCleanup = createDeferredPromise<void>();
    let cleanup: Promise<void> | null = null;
    let persistence: Promise<unknown> | null = null;

    try {
      cleanup = (async () => {
        await authStorage.waitForSensitiveLogoutCleanupLock(cleanupOwnerToken);
        cleanupLockAcquired.resolve();
        await releaseCleanup.promise;
        await db.delete();
        authStorage.endSensitiveLogoutBarrierCleanup(cleanupOwnerToken);
      })();
      await cleanupLockAcquired.promise;

      let persistenceSettled = false;
      persistence = authStorage
        .setUser({
          id: "next-user",
          name: "Next User",
          email: "next-user@secpal.dev",
          emailVerified: true,
        })
        .finally(() => {
          persistenceSettled = true;
        });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(persistenceSettled).toBe(false);

      releaseCleanup.resolve();
      await cleanup;
      await expect(persistence).resolves.toEqual({ status: "persisted" });
      await expect(authStorage.getUser()).resolves.toEqual({
        id: "next-user",
        name: "Next User",
        email: "next-user@secpal.dev",
        emailVerified: true,
      });
    } finally {
      releaseCleanup.resolve();
      authStorage.endSensitiveLogoutBarrierCleanup(cleanupOwnerToken);
      await Promise.allSettled(
        [cleanup, persistence].filter(
          (operation): operation is Promise<unknown> => operation !== null
        )
      );
    }
  });

  it("clears a stale single-tab sensitive logout cleanup owner", () => {
    const ownerToken = authStorage.beginSensitiveLogoutBarrierCleanup();

    authStorage.completeStaleSensitiveLogoutBarrierCleanup(ownerToken);

    expect(
      localStorage.getItem("auth_logout_skip_vault_table_cleanup")
    ).toBeNull();
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(0);
    authStorage.endSensitiveLogoutBarrierCleanup(ownerToken);
  });

  it("preserves multi-tab sensitive logout cleanup owners during stale cleanup reconciliation", () => {
    const ownerToken = authStorage.beginSensitiveLogoutBarrierCleanup();
    localStorage.setItem(
      `${SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX}other-tab`,
      String(Date.now())
    );

    authStorage.completeStaleSensitiveLogoutBarrierCleanup(ownerToken);

    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(2);
    authStorage.endSensitiveLogoutBarrierCleanup(ownerToken);
  });

  it("ignores stale owner markers when a new non-sensitive barrier starts", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    localStorage.setItem("auth_logout_barrier", "stale-barrier");
    localStorage.setItem("auth_logout_skip_vault_table_cleanup", "1");
    localStorage.setItem(
      `${SENSITIVE_LOGOUT_CLEANUP_OWNER_KEY_PREFIX}closed-context`,
      "1"
    );

    await authStorage.setUser(user);
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(1);

    await authStorage.clear({ clearOfflineVaultTables: true });

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(getSensitiveLogoutCleanupOwnerKeys()).toHaveLength(0);
    expect(await db.vaultProfile.count()).toBe(0);
  });

  it("clears vault tables when cleanup is explicitly requested for an active logout barrier", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);

    localStorage.setItem("auth_logout_barrier", "1");
    authStorage.setSkipBarrierVaultTableCleanup(true);

    await authStorage.removeUser({ clearOfflineVaultTables: true });

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
  });

  it("does not honor a stale skip marker when no logout barrier is active", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(await db.vaultProfile.count()).toBe(1);

    authStorage.setSkipBarrierVaultTableCleanup(true);
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();

    await authStorage.removeUser({ allowBarrierSkipUpgrade: true });

    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    expect(await db.vaultProfile.count()).toBe(0);
  });

  it("logs and resolves when vault table cleanup fails during removeUser", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const cleanupError = new Error("clear failed");
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await authStorage.setUser(user);
    vi.spyOn(db.vaultProfile, "clear").mockRejectedValue(cleanupError);

    await expect(authStorage.removeUser()).resolves.toBeUndefined();

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Failed to clear offline vault tables on logout:",
      cleanupError
    );
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
  });

  it("does not reject concurrent vault cleanup waiters when logout cleanup fails", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const cleanupError = new Error("clear failed");
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    let rejectCleanup!: (reason?: unknown) => void;
    const cleanupPromise = new Promise<void>((_resolve, reject) => {
      rejectCleanup = reject;
    });

    await authStorage.setUser(user);
    vi.spyOn(db.vaultProfile, "clear").mockReturnValue(
      cleanupPromise as ReturnType<typeof db.vaultProfile.clear>
    );

    const removeUserPromise = authStorage.removeUser();
    const waitForCleanupPromise =
      authStorage.waitForInFlightVaultTableCleanup();

    rejectCleanup(cleanupError);

    await expect(waitForCleanupPromise).resolves.toBeUndefined();
    await expect(removeUserPromise).resolves.toBeUndefined();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Failed to clear offline vault tables on logout:",
      cleanupError
    );
  });

  it("times out long-running vault-table cleanup waiters and continues", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    let resolveLongRunningCleanup!: () => void;
    const cleanupDeferred = new Promise<void>((resolve) => {
      resolveLongRunningCleanup = resolve;
    });
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      return undefined;
    });
    vi.spyOn(db.vaultProfile, "clear").mockImplementationOnce(
      () => cleanupDeferred as ReturnType<typeof db.vaultProfile.clear>
    );

    try {
      await authStorage.setUser(user);
      vi.useFakeTimers();

      const removeUserPromise = authStorage.removeUser();
      const waitForCleanupPromise =
        authStorage.waitForInFlightVaultTableCleanup();

      await vi.advanceTimersByTimeAsync(5_000);

      await expect(waitForCleanupPromise).resolves.toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Timed out waiting for in-flight vault cleanup during logout; continuing with best-effort sensitive cleanup."
      );

      resolveLongRunningCleanup();
      await removeUserPromise;
    } finally {
      vi.useRealTimers();
      consoleWarnSpy.mockRestore();
    }
  });

  it("aborts cleanup while the offline vault module is still loading", async () => {
    const moduleLoadStarted = createDeferredPromise<void>();
    const releaseModuleLoad = createDeferredPromise<typeof offlineVault>();

    vi.resetModules();
    vi.doMock("../lib/offlineVault", () => {
      moduleLoadStarted.resolve();
      return releaseModuleLoad.promise;
    });

    const { authStorage: isolatedAuthStorage } = await import("./storage");
    const cleanup = isolatedAuthStorage.removeUser();

    try {
      await moduleLoadStarted.promise;

      await expect(
        isolatedAuthStorage.abortPendingVaultCleanup()
      ).resolves.toBeUndefined();
      await expect(cleanup).resolves.toBeUndefined();
    } finally {
      releaseModuleLoad.resolve(offlineVault);
      await Promise.allSettled([cleanup]);
      vi.doUnmock("../lib/offlineVault");
      vi.resetModules();
    }
  });
});
