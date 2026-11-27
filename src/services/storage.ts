// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
  AUTH_VAULT_LOCK_KEY,
} from "../lib/offlineVaultKeys";
import { runWithOfflineVaultLifecycleLock } from "../lib/offlineVaultLifecycleLock";
import {
  createRecoverableLazyModuleError,
  isRecoverableLazyModuleError,
  isTransientModuleLoadError,
} from "../lib/lazyModuleErrors";
import {
  clearActiveOfflineVaultSession,
  clearRecentAuthVaultKeyMaterials,
} from "../lib/offlineVaultRuntime";
import { awaitAbortable, throwIfAborted } from "../lib/abortablePromise";
import { authLifecycle, type AuthLifecycleOwner } from "../lib/authLifecycle";
import { createSecureRandomToken } from "../lib/secureRandom";
import { clearDestructiveSensitiveClientState } from "../lib/clientStateCleanup";
import { buildEnvelopeMacPayload } from "./authStorageEnvelope";
import { sanitizePersistedAuthUser, type PersistedAuthUser } from "./authState";
import { getCsrfTokenFromCookie } from "./csrf";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const AUTH_STORAGE_VERSION = 2;
const AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type AuthStorageVersion = typeof AUTH_STORAGE_VERSION;

interface AuthStorageEnvelope {
  scheme: typeof AUTH_STORAGE_SCHEME;
  version: AuthStorageVersion;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

async function loadOfflineVaultModule() {
  return await import("../lib/offlineVault");
}

function isAuthStorageVersion(value: unknown): value is AuthStorageVersion {
  return value === AUTH_STORAGE_VERSION;
}

function getAuthStorageIterations(): number {
  return AUTH_STORAGE_PBKDF2_ITERATIONS;
}

function getAuthStorageKeyMaterial(): string | null {
  const csrfToken = getCsrfTokenFromCookie();

  if (!csrfToken) {
    return null;
  }

  return `secpal-auth-storage:${csrfToken}`;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function deriveAuthStorageKeys(
  keyMaterial: string,
  salt: Uint8Array,
  iterations: number
): Promise<{ encryptionKey: CryptoKey; macKey: CryptoKey }> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedKeyBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    baseKey,
    AUTH_STORAGE_DERIVED_KEY_BYTES * 8
  );
  const derivedKey = new Uint8Array(derivedKeyBits);

  if (derivedKey.byteLength !== AUTH_STORAGE_DERIVED_KEY_BYTES) {
    throw new Error("Derived auth storage key has an unexpected length.");
  }

  const encryptionKeyBytes = derivedKey.slice(0, AUTH_STORAGE_HALF_KEY_BYTES);
  const macKeyBytes = derivedKey.slice(AUTH_STORAGE_HALF_KEY_BYTES);

  const [encryptionKey, macKey] = await Promise.all([
    crypto.subtle.importKey(
      "raw",
      encryptionKeyBytes,
      {
        name: "AES-CBC",
        length: AUTH_STORAGE_HALF_KEY_BYTES * 8,
      },
      false,
      ["encrypt", "decrypt"]
    ),
    crypto.subtle.importKey(
      "raw",
      macKeyBytes,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"]
    ),
  ]);

  return { encryptionKey, macKey };
}

function hasStoredUserRecord(storageKey: string): boolean {
  return localStorage.getItem(storageKey) !== null;
}

async function verifyEnvelopeMac(
  envelope: Omit<AuthStorageEnvelope, "mac">,
  mac: string,
  macKey: CryptoKey
): Promise<boolean> {
  return await crypto.subtle.verify(
    "HMAC",
    macKey,
    toArrayBuffer(decodeBase64(mac)),
    textEncoder.encode(buildEnvelopeMacPayload(envelope))
  );
}

async function decryptAuthPayload(
  ciphertext: Uint8Array,
  encryptionKey: CryptoKey,
  iv: Uint8Array
): Promise<string | null> {
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(iv),
      },
      encryptionKey,
      toArrayBuffer(ciphertext)
    );

    return textDecoder.decode(plaintext);
  } catch {
    return null;
  }
}

function isAuthStorageEnvelope(value: unknown): value is AuthStorageEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.scheme === AUTH_STORAGE_SCHEME &&
    isAuthStorageVersion(candidate.version) &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.mac === "string"
  );
}

async function decryptPersistedAuthUser(
  storedUser: string
): Promise<PersistedAuthUser | null> {
  let parsedStoredUser: unknown;

  try {
    parsedStoredUser = JSON.parse(storedUser) as unknown;
  } catch {
    return null;
  }

  if (!isAuthStorageEnvelope(parsedStoredUser)) {
    return null;
  }

  const keyMaterial = getAuthStorageKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const envelopeWithoutMac = {
    scheme: parsedStoredUser.scheme,
    version: parsedStoredUser.version,
    salt: parsedStoredUser.salt,
    iv: parsedStoredUser.iv,
    ciphertext: parsedStoredUser.ciphertext,
  } satisfies Omit<AuthStorageEnvelope, "mac">;
  const { encryptionKey, macKey } = await deriveAuthStorageKeys(
    keyMaterial,
    decodeBase64(parsedStoredUser.salt),
    getAuthStorageIterations()
  );
  const isMacValid = await verifyEnvelopeMac(
    envelopeWithoutMac,
    parsedStoredUser.mac,
    macKey
  );

  if (!isMacValid) {
    return null;
  }

  const decryptedUser = await decryptAuthPayload(
    decodeBase64(parsedStoredUser.ciphertext),
    encryptionKey,
    decodeBase64(parsedStoredUser.iv)
  );

  if (!decryptedUser) {
    return null;
  }

  return sanitizePersistedAuthUser(JSON.parse(decryptedUser) as unknown);
}

/**
 * Storage abstraction layer for auth data
 * Implements Single Responsibility Principle (SOLID)
 * Allows easy mocking in tests and future storage backend changes
 *
 * Note: Token storage was removed in v0.x as authentication now uses
 * httpOnly cookies (Sanctum SPA mode). See issue #246.
 */
export interface AuthStorage {
  hasStoredUser(): boolean;
  getUserRevalidationOwnerToken(): string | null;
  requireUserRevalidation(): string;
  completeUserRevalidation(ownerToken: string | null): void;
  hasVaultLock(): boolean;
  getUser(options?: AuthStorageReadOptions): Promise<User | null>;
  setUser(
    user: User,
    options?: AuthStorageWriteOptions
  ): Promise<AuthUserPersistenceResult>;
  lockVault(): void;
  unlockVault(owner?: AuthLifecycleOwner): Promise<AuthVaultUnlockResult>;
  clear(options?: AuthStorageLogoutOptions): Promise<void>;
  hasLogoutBarrier(): boolean;
}

export interface AuthStorageReadOptions {
  signal?: AbortSignal;
  owner?: AuthLifecycleOwner;
  allowLockedVault?: boolean;
}

export interface AuthStorageWriteOptions {
  shouldCommit?: () => boolean;
  owner?: AuthLifecycleOwner;
}

export type AuthUserPersistenceResult =
  { status: "persisted" } | { status: "superseded" };

export type AuthVaultUnlockResult =
  | { status: "unlocked"; user: User }
  | { status: "unavailable" }
  | { status: "empty" };

export class AuthUserPersistenceError extends Error {
  constructor() {
    super("Secure auth persistence failed.");
    this.name = "AuthUserPersistenceError";
  }
}

interface AuthStorageLogoutOptions {
  sensitive?: boolean;
  trailing?: (isCurrent: () => boolean) => Promise<void>;
  afterTrailing?: () => void;
}

interface StoredUserMarkerSnapshot {
  user: string | null;
  vault: string | null;
  vaultLock: string | null;
  revalidationOwner: string | null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * LocalStorage implementation of AuthStorage
 */
class LocalStorageAuthStorage implements AuthStorage {
  private readonly USER_KEY = "auth_user";
  private readonly VAULT_KEY = AUTH_VAULT_STORAGE_KEY;
  private readonly VAULT_LOCK_KEY = AUTH_VAULT_LOCK_KEY;
  /**
   * Clean up any legacy auth_token that might exist from before migration.
   * This is called once on init to ensure no stale tokens remain.
   */
  private cleanupLegacyToken(): void {
    localStorage.removeItem("auth_token");
  }

  constructor() {
    // Clean up any legacy token from before httpOnly cookie migration
    this.cleanupLegacyToken();
  }

  hasLogoutBarrier(): boolean {
    return authLifecycle.hasBarrier();
  }

  hasVaultLock(): boolean {
    return (
      localStorage.getItem(this.VAULT_LOCK_KEY) !== null &&
      localStorage.getItem(this.VAULT_KEY) !== null
    );
  }

  hasStoredUser(): boolean {
    return (
      !this.hasLogoutBarrier() &&
      !this.hasVaultLock() &&
      !this.isUserRevalidationRequired() &&
      (localStorage.getItem(this.VAULT_KEY) !== null ||
        hasStoredUserRecord(this.USER_KEY))
    );
  }

  getUserRevalidationOwnerToken(): string | null {
    return localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
  }

  requireUserRevalidation(): string {
    const activeOwnerToken = this.getUserRevalidationOwnerToken();

    if (activeOwnerToken !== null) {
      return activeOwnerToken;
    }

    const ownerToken = createSecureRandomToken();
    localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, ownerToken);
    return ownerToken;
  }

  completeUserRevalidation(ownerToken: string | null): void {
    if (
      ownerToken === null ||
      this.getUserRevalidationOwnerToken() !== ownerToken
    ) {
      return;
    }

    localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
  }

  private isUserRevalidationRequired(): boolean {
    return this.getUserRevalidationOwnerToken() !== null;
  }

  private clearStoredUserMarkers(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.VAULT_KEY);
    localStorage.removeItem(this.VAULT_LOCK_KEY);
    localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
  }

  private captureStoredUserMarkers(): StoredUserMarkerSnapshot {
    return {
      user: localStorage.getItem(this.USER_KEY),
      vault: localStorage.getItem(this.VAULT_KEY),
      vaultLock: localStorage.getItem(this.VAULT_LOCK_KEY),
      revalidationOwner: localStorage.getItem(
        AUTH_USER_REVALIDATION_REQUIRED_KEY
      ),
    };
  }

  private storedUserMarkersMatch(expected: StoredUserMarkerSnapshot): boolean {
    const current = this.captureStoredUserMarkers();

    return (
      current.user === expected.user &&
      current.vault === expected.vault &&
      current.vaultLock === expected.vaultLock &&
      current.revalidationOwner === expected.revalidationOwner
    );
  }

  private async clearInvalidStoredUser(
    signal?: AbortSignal,
    expectedMarkers = this.captureStoredUserMarkers()
  ): Promise<null> {
    const logoutBarrier = authLifecycle.barrier();
    const mayClear = () =>
      authLifecycle.barrier() === logoutBarrier &&
      this.storedUserMarkersMatch(expectedMarkers);
    let clearInvalidOfflineVaultArtifacts: typeof import("../lib/offlineVault").clearInvalidOfflineVaultArtifacts;
    try {
      ({ clearInvalidOfflineVaultArtifacts } = await awaitAbortable(
        loadOfflineVaultModule(),
        signal
      ));
    } catch (error) {
      if (isTransientModuleLoadError(error)) {
        throw createRecoverableLazyModuleError(
          "Stored offline auth data is temporarily unavailable on this device.",
          error
        );
      }
      throw error;
    }
    await runWithOfflineVaultLifecycleLock(async (lifecycleSignal) => {
      if (mayClear()) {
        await clearInvalidOfflineVaultArtifacts({ signal: lifecycleSignal });
        throwIfAborted(lifecycleSignal);
        if (authLifecycle.barrier() === logoutBarrier) {
          this.clearStoredUserMarkers();
        }
      }
    }, signal);
    throwIfAborted(signal);
    return null;
  }

  async getUser(options: AuthStorageReadOptions = {}): Promise<User | null> {
    const owner = options.owner ?? authLifecycle.current();
    const signal = options.signal
      ? AbortSignal.any([owner.signal, options.signal])
      : owner.signal;
    try {
      if (!authLifecycle.owns(owner)) {
        return null;
      }
      const user = await this.readUser({ ...options, signal });
      return authLifecycle.owns(owner) && !this.hasLogoutBarrier()
        ? user
        : null;
    } catch (error) {
      throwIfAborted(options.signal);
      if (!authLifecycle.owns(owner)) {
        return null;
      }
      throw error;
    }
  }

  private async readUser(
    options: AuthStorageReadOptions
  ): Promise<User | null> {
    const { signal, allowLockedVault = false } = options;
    throwIfAborted(signal);

    if (this.hasLogoutBarrier()) {
      return null;
    }

    if (this.isUserRevalidationRequired()) {
      return null;
    }

    if (!allowLockedVault && this.hasVaultLock()) {
      return null;
    }

    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      const expectedMarkers = this.captureStoredUserMarkers();
      let hasInvalidStoredOfflineVaultState: typeof import("../lib/offlineVault").hasInvalidStoredOfflineVaultState;
      let readPersistedAuthUserFromVault: typeof import("../lib/offlineVault").readPersistedAuthUserFromVault;

      try {
        ({ hasInvalidStoredOfflineVaultState, readPersistedAuthUserFromVault } =
          await loadOfflineVaultModule());
        throwIfAborted(signal);
      } catch (error) {
        if (isTransientModuleLoadError(error)) {
          throw createRecoverableLazyModuleError(
            "Stored offline auth data is temporarily unavailable on this device.",
            error
          );
        }

        throw error;
      }

      const storedVaultUser = await readPersistedAuthUserFromVault({
        signal,
        allowLockedVault,
      });
      throwIfAborted(signal);

      if (!storedVaultUser) {
        if (hasInvalidStoredOfflineVaultState()) {
          return this.clearInvalidStoredUser(signal, expectedMarkers);
        }

        if (localStorage.getItem(this.VAULT_KEY) !== null) {
          return null;
        }

        return this.clearInvalidStoredUser(signal, expectedMarkers);
      }

      return storedVaultUser;
    }

    const expectedMarkers = this.captureStoredUserMarkers();
    const storedUser = expectedMarkers.user;
    if (!storedUser) return null;
    try {
      const sanitizedUser = await decryptPersistedAuthUser(storedUser);
      throwIfAborted(signal);

      if (!sanitizedUser) {
        return this.clearInvalidStoredUser(signal, expectedMarkers);
      }

      let initializeOfflineVault: typeof import("../lib/offlineVault").initializeOfflineVault;

      try {
        ({ initializeOfflineVault } = await loadOfflineVaultModule());
        throwIfAborted(signal);
      } catch (error) {
        if (isTransientModuleLoadError(error)) {
          throw createRecoverableLazyModuleError(
            "Stored offline auth data is temporarily unavailable on this device.",
            error
          );
        }

        throw error;
      }

      if (
        this.hasLogoutBarrier() ||
        !this.storedUserMarkersMatch(expectedMarkers)
      ) {
        return null;
      }
      await initializeOfflineVault(sanitizedUser, {
        signal,
        shouldCommit: () =>
          !this.hasLogoutBarrier() &&
          localStorage.getItem(this.USER_KEY) === expectedMarkers.user,
      });
      throwIfAborted(signal);

      return sanitizedUser;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      if (isRecoverableLazyModuleError(error)) {
        throw error;
      }

      console.error("Failed to parse stored user data:", error);
      return this.clearInvalidStoredUser(signal, expectedMarkers);
    }
  }

  async setUser(
    user: User,
    options: AuthStorageWriteOptions = {}
  ): Promise<AuthUserPersistenceResult> {
    if (
      (options.shouldCommit && !options.shouldCommit()) ||
      (options.owner && !authLifecycle.owns(options.owner))
    ) {
      return { status: "superseded" };
    }

    const owner = options.owner ?? authLifecycle.begin("persist");
    const logoutBarrierAtStart = authLifecycle.barrier();
    const admission = await authLifecycle.admitPersistence(
      owner,
      logoutBarrierAtStart
    );
    if (admission === "recovery-blocked") {
      throw new AuthUserPersistenceError();
    }
    let committed = false;
    const shouldCommit = () =>
      authLifecycle.owns(owner) &&
      authLifecycle.barrier() === (committed ? null : logoutBarrierAtStart) &&
      (options.shouldCommit?.() ?? true);
    if (admission === "superseded" || !shouldCommit()) {
      return { status: "superseded" };
    }
    const sanitizedUser = sanitizePersistedAuthUser(user);

    if (!sanitizedUser) {
      localStorage.removeItem(this.USER_KEY);
      throw new AuthUserPersistenceError();
    }

    try {
      const { initializeOfflineVault } = await loadOfflineVaultModule();
      if (!shouldCommit()) {
        return { status: "superseded" };
      }

      await initializeOfflineVault(sanitizedUser, {
        signal: owner.signal,
        shouldCommit,
        onPersisted: () => {
          if (shouldCommit()) {
            authLifecycle.retireBarrier(logoutBarrierAtStart);
            if (authLifecycle.barrier() === null) {
              localStorage.removeItem(this.VAULT_LOCK_KEY);
              committed = true;
            }
          }
        },
      });
    } catch {
      if (!shouldCommit()) {
        return { status: "superseded" };
      }

      const persistenceError = new AuthUserPersistenceError();
      console.error("Failed to persist stored user data:", persistenceError);
      localStorage.removeItem(this.USER_KEY);
      throw persistenceError;
    }

    if (!shouldCommit()) {
      return { status: "superseded" };
    }

    return { status: "persisted" };
  }

  lockVault(): void {
    authLifecycle.begin("lock");
    if (this.hasLogoutBarrier()) {
      clearActiveOfflineVaultSession();
      return;
    }
    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      localStorage.setItem(this.VAULT_LOCK_KEY, "1");
    }
    localStorage.removeItem(this.USER_KEY);
    clearActiveOfflineVaultSession();
  }

  async unlockVault(
    owner = authLifecycle.begin("unlock")
  ): Promise<AuthVaultUnlockResult> {
    if (this.hasLogoutBarrier()) {
      return { status: "empty" };
    }

    const unlockedUser = await this.getUser({ allowLockedVault: true, owner });

    if (this.hasLogoutBarrier()) {
      return { status: "empty" };
    }
    if (!authLifecycle.owns(owner)) {
      return { status: "unavailable" };
    }

    if (!unlockedUser) {
      if (localStorage.getItem(this.VAULT_KEY) !== null) {
        return { status: "unavailable" };
      }

      return { status: "empty" };
    }

    localStorage.removeItem(this.VAULT_LOCK_KEY);
    return { status: "unlocked", user: unlockedUser };
  }

  async clear(options: AuthStorageLogoutOptions = {}): Promise<void> {
    clearActiveOfflineVaultSession();
    clearRecentAuthVaultKeyMaterials();
    const result = await authLifecycle.logout({
      mode: options.sensitive ? "sensitive" : "vault",
      prepare: async (signal, mode) => {
        const clear =
          mode === "sensitive"
            ? clearDestructiveSensitiveClientState
            : (await awaitAbortable(loadOfflineVaultModule(), signal))
                .clearOfflineVaultTables;
        return async (lifecycleSignal) => {
          this.clearStoredUserMarkers();
          clearActiveOfflineVaultSession();
          clearRecentAuthVaultKeyMaterials();
          await clear({ signal: lifecycleSignal });
        };
      },
      trailing: options.trailing,
      afterTrailing: options.afterTrailing,
    });
    if ("error" in result) {
      throw result.error;
    }
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
