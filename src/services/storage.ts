// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
  AUTH_VAULT_LOCK_KEY,
} from "../lib/offlineVaultKeys";
import {
  reserveOfflineVaultLifecycleLock,
  runWithOfflineVaultLifecycleLock,
  type VaultLifecycleLockReservation,
} from "../lib/offlineVaultLifecycleLock";
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
import { createSecureRandomToken } from "../lib/secureRandom";
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
  unlockVault(): Promise<AuthVaultUnlockResult>;
  removeUser(options?: AuthStorageClearOptions): Promise<void>;
  clear(options?: AuthStorageClearOptions): Promise<void>;
  hasLogoutBarrier(): boolean;
  shouldSkipBarrierVaultTableCleanup(): boolean;
  setSkipBarrierVaultTableCleanup(shouldSkip: boolean): void;
  beginSensitiveLogoutBarrierCleanup(): string;
  endSensitiveLogoutBarrierCleanup(ownerToken: string): void;
  completeStaleSensitiveLogoutBarrierCleanup(ownerToken: string): void;
  waitForSensitiveLogoutCleanupLock(
    ownerToken: string | null
  ): Promise<AbortSignal | null>;
  abortPendingPersistence(): void;
  abortPendingVaultCleanup(): Promise<void>;
  waitForInFlightVaultTableCleanup(): Promise<void>;
}

export interface AuthStorageReadOptions {
  signal?: AbortSignal;
  allowLockedVault?: boolean;
}

export interface AuthStorageWriteOptions {
  shouldCommit?: () => boolean;
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

interface AuthStorageClearOptions {
  clearOfflineVaultTables?: boolean;
  allowBarrierSkipUpgrade?: boolean;
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
  private readonly LOGOUT_BARRIER_KEY = "auth_logout_barrier";
  private readonly SKIP_VAULT_TABLE_CLEANUP_BARRIER_KEY =
    "auth_logout_skip_vault_table_cleanup";
  private readonly SENSITIVE_LOGOUT_BARRIER_CLEANUP_OWNER_KEY_PREFIX =
    "auth_logout_skip_vault_table_cleanup_owner:";
  private readonly VAULT_TABLE_CLEANUP_WAIT_TIMEOUT_MS = 5_000;
  private activeCleanupController: AbortController | null = null;
  private activeCleanupPromise: Promise<void> = Promise.resolve();
  private activePersistenceController: AbortController | null = null;
  private readonly sensitiveLogoutCleanupLockReservations = new Map<
    string,
    VaultLifecycleLockReservation
  >();

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

  private clearLogoutBarrier(): void {
    localStorage.removeItem(this.LOGOUT_BARRIER_KEY);
  }

  private setLogoutBarrier(): void {
    this.activePersistenceController?.abort();
    localStorage.setItem(this.LOGOUT_BARRIER_KEY, createSecureRandomToken());
  }

  setSkipBarrierVaultTableCleanup(shouldSkip: boolean): void {
    if (shouldSkip) {
      localStorage.setItem(this.SKIP_VAULT_TABLE_CLEANUP_BARRIER_KEY, "1");
      return;
    }

    localStorage.removeItem(this.SKIP_VAULT_TABLE_CLEANUP_BARRIER_KEY);
  }

  shouldSkipBarrierVaultTableCleanup(): boolean {
    return (
      localStorage.getItem(this.SKIP_VAULT_TABLE_CLEANUP_BARRIER_KEY) !==
        null || this.hasSensitiveLogoutBarrierCleanupOwners()
    );
  }

  beginSensitiveLogoutBarrierCleanup(): string {
    const hasActiveSkipBarrier =
      this.hasLogoutBarrier() && this.shouldSkipBarrierVaultTableCleanup();
    const ownerToken = createSecureRandomToken();

    if (!hasActiveSkipBarrier) {
      this.clearSensitiveLogoutBarrierCleanupOwners();
    }

    try {
      this.sensitiveLogoutCleanupLockReservations.set(
        ownerToken,
        reserveOfflineVaultLifecycleLock()
      );
      this.setLogoutBarrier();
      localStorage.setItem(
        this.getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken),
        "1"
      );
      this.setSkipBarrierVaultTableCleanup(true);
    } catch (error) {
      this.endSensitiveLogoutBarrierCleanup(ownerToken);
      throw error;
    }

    return ownerToken;
  }

  async waitForSensitiveLogoutCleanupLock(
    ownerToken: string | null
  ): Promise<AbortSignal | null> {
    if (ownerToken === null) {
      return null;
    }

    const reservation =
      this.sensitiveLogoutCleanupLockReservations.get(ownerToken);
    const acquisition = await reservation?.acquired;

    if (acquisition?.status === "failed") {
      throw acquisition.error;
    }

    return reservation?.signal ?? null;
  }

  endSensitiveLogoutBarrierCleanup(ownerToken: string): void {
    try {
      localStorage.removeItem(
        this.getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken)
      );

      if (this.hasSensitiveLogoutBarrierCleanupOwners()) {
        return;
      }

      this.setSkipBarrierVaultTableCleanup(false);
    } finally {
      const reservation =
        this.sensitiveLogoutCleanupLockReservations.get(ownerToken);
      this.sensitiveLogoutCleanupLockReservations.delete(ownerToken);
      reservation?.release();
    }
  }

  completeStaleSensitiveLogoutBarrierCleanup(ownerToken: string): void {
    const ownerKeys = this.getSensitiveLogoutBarrierCleanupOwnerKeys();
    const ownerKey = this.getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken);

    if (ownerKeys.length !== 1 || ownerKeys[0] !== ownerKey) {
      return;
    }

    this.clearSensitiveLogoutBarrierCleanupOwners();
    this.setSkipBarrierVaultTableCleanup(false);
  }

  private clearSensitiveLogoutBarrierCleanupOwners(): void {
    const ownerKeys = this.getSensitiveLogoutBarrierCleanupOwnerKeys();

    for (const ownerKey of ownerKeys) {
      localStorage.removeItem(ownerKey);
    }
  }

  private hasSensitiveLogoutBarrierCleanupOwners(): boolean {
    return this.getSensitiveLogoutBarrierCleanupOwnerKeys().length > 0;
  }

  private getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken: string): string {
    return `${this.SENSITIVE_LOGOUT_BARRIER_CLEANUP_OWNER_KEY_PREFIX}${ownerToken}`;
  }

  private getSensitiveLogoutBarrierCleanupOwnerKeys(): string[] {
    const ownerKeys: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);

      if (
        storageKey?.startsWith(
          this.SENSITIVE_LOGOUT_BARRIER_CLEANUP_OWNER_KEY_PREFIX
        )
      ) {
        ownerKeys.push(storageKey);
      }
    }

    return ownerKeys;
  }

  private async waitForBarrierCleanupUpgrade(): Promise<void> {
    await new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, 0);
    });
  }

  async waitForInFlightVaultTableCleanup(): Promise<void> {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

    try {
      const waitResult = await Promise.race([
        this.activeCleanupPromise
          .then(() => "completed" as const)
          .catch(() => "failed" as const),
        new Promise<"timed-out">((resolve) => {
          timeoutId = globalThis.setTimeout(() => {
            resolve("timed-out");
          }, this.VAULT_TABLE_CLEANUP_WAIT_TIMEOUT_MS);
        }),
      ]);

      if (waitResult === "timed-out") {
        console.warn(
          "Timed out waiting for in-flight vault cleanup during logout; continuing with best-effort sensitive cleanup."
        );
      }
    } catch {
      // The cleanup initiator handles the vault-table failure; waiters should
      // still continue with their own best-effort logout cleanup.
    } finally {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    }
  }

  async abortPendingVaultCleanup(): Promise<void> {
    const pendingCleanup = this.activeCleanupPromise;
    this.activeCleanupController?.abort();

    try {
      await pendingCleanup;
    } catch (error) {
      if (!isAbortError(error)) {
        throw error;
      }
    }
  }

  abortPendingPersistence(): void {
    this.activePersistenceController?.abort();
  }

  private async clearVaultTables(signal: AbortSignal): Promise<void> {
    await runWithOfflineVaultLifecycleLock(async (lifecycleSignal) => {
      const effectiveSignal = lifecycleSignal ?? signal;
      const { clearOfflineVaultTables } = await awaitAbortable(
        loadOfflineVaultModule(),
        effectiveSignal
      );
      throwIfAborted(effectiveSignal);
      await clearOfflineVaultTables({ signal: effectiveSignal });
    }, signal);
  }

  hasLogoutBarrier(): boolean {
    return localStorage.getItem(this.LOGOUT_BARRIER_KEY) !== null;
  }

  hasVaultLock(): boolean {
    const locked = localStorage.getItem(this.VAULT_LOCK_KEY) !== null;

    if (locked && localStorage.getItem(this.VAULT_KEY) === null) {
      localStorage.removeItem(this.VAULT_LOCK_KEY);
      return false;
    }

    return locked;
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
    await this.runExclusiveCleanup(
      (cleanupSignal) =>
        runWithOfflineVaultLifecycleLock(async (lifecycleSignal) => {
          const effectiveSignal = lifecycleSignal ?? cleanupSignal;

          if (!this.storedUserMarkersMatch(expectedMarkers)) {
            return;
          }

          let clearInvalidOfflineVaultArtifacts: typeof import("../lib/offlineVault").clearInvalidOfflineVaultArtifacts;

          try {
            ({ clearInvalidOfflineVaultArtifacts } = await awaitAbortable(
              loadOfflineVaultModule(),
              effectiveSignal
            ));
            throwIfAborted(effectiveSignal);
          } catch (error) {
            if (isTransientModuleLoadError(error)) {
              throw createRecoverableLazyModuleError(
                "Stored offline auth data is temporarily unavailable on this device.",
                error
              );
            }

            throw error;
          }

          await clearInvalidOfflineVaultArtifacts({
            signal: effectiveSignal,
          });
          throwIfAborted(effectiveSignal);
          this.clearStoredUserMarkers();
        }, cleanupSignal),
      signal
    );
    throwIfAborted(signal);
    return null;
  }

  async getUser(options: AuthStorageReadOptions = {}): Promise<User | null> {
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

    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;
    try {
      const sanitizedUser = await decryptPersistedAuthUser(storedUser);
      throwIfAborted(signal);

      if (!sanitizedUser) {
        return this.clearInvalidStoredUser(signal);
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

      await initializeOfflineVault(sanitizedUser, { signal });
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
      return this.clearInvalidStoredUser(signal);
    }
  }

  async setUser(
    user: User,
    options: AuthStorageWriteOptions = {}
  ): Promise<AuthUserPersistenceResult> {
    if (options.shouldCommit && !options.shouldCommit()) {
      return { status: "superseded" };
    }

    const logoutBarrierAtStart = localStorage.getItem(this.LOGOUT_BARRIER_KEY);
    await this.abortPendingVaultCleanup();

    if (options.shouldCommit && !options.shouldCommit()) {
      return { status: "superseded" };
    }

    this.activePersistenceController?.abort();
    const controller = new AbortController();
    this.activePersistenceController = controller;
    const hasNewerLogoutBarrier = () => {
      const currentLogoutBarrier = localStorage.getItem(
        this.LOGOUT_BARRIER_KEY
      );

      return (
        currentLogoutBarrier !== null &&
        currentLogoutBarrier !== logoutBarrierAtStart
      );
    };
    const shouldCommit = () =>
      !controller.signal.aborted &&
      !hasNewerLogoutBarrier() &&
      (options.shouldCommit?.() ?? true);
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
        signal: controller.signal,
        shouldCommit,
      });
    } catch {
      if (!shouldCommit()) {
        return { status: "superseded" };
      }

      const persistenceError = new AuthUserPersistenceError();
      console.error("Failed to persist stored user data:", persistenceError);
      localStorage.removeItem(this.USER_KEY);
      throw persistenceError;
    } finally {
      if (this.activePersistenceController === controller) {
        this.activePersistenceController = null;
      }
    }

    if (!shouldCommit()) {
      return { status: "superseded" };
    }

    this.clearLogoutBarrier();
    localStorage.removeItem(this.VAULT_LOCK_KEY);
    localStorage.removeItem(this.USER_KEY);
    return { status: "persisted" };
  }

  lockVault(): void {
    this.activePersistenceController?.abort();
    this.clearLogoutBarrier();
    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      localStorage.setItem(this.VAULT_LOCK_KEY, "1");
    }
    localStorage.removeItem(this.USER_KEY);
    clearActiveOfflineVaultSession();
  }

  async unlockVault(): Promise<AuthVaultUnlockResult> {
    if (this.hasLogoutBarrier()) {
      await this.removeUser();
      return { status: "empty" };
    }

    const unlockedUser = await this.getUser({ allowLockedVault: true });

    if (this.hasLogoutBarrier()) {
      await this.removeUser();
      return { status: "empty" };
    }

    if (!unlockedUser) {
      if (localStorage.getItem(this.VAULT_KEY) !== null) {
        return { status: "unavailable" };
      }

      await this.removeUser();
      return { status: "empty" };
    }

    localStorage.removeItem(this.VAULT_LOCK_KEY);
    return { status: "unlocked", user: unlockedUser };
  }

  async removeUser(options: AuthStorageClearOptions = {}): Promise<void> {
    return this.runExclusiveCleanup((signal) =>
      this.removeUserWithSignal(options, signal)
    );
  }

  private runExclusiveCleanup(
    operation: (signal: AbortSignal) => Promise<void>,
    sourceSignal?: AbortSignal
  ): Promise<void> {
    throwIfAborted(sourceSignal);

    if (this.activeCleanupController) {
      return awaitAbortable(this.activeCleanupPromise, sourceSignal);
    }

    const controller = new AbortController();
    const abortFromSource = () => controller.abort();
    sourceSignal?.addEventListener("abort", abortFromSource, { once: true });
    this.activeCleanupController = controller;
    const cleanup = awaitAbortable(
      operation(controller.signal),
      controller.signal
    )
      .catch((error: unknown) => {
        if (!isAbortError(error) || !controller.signal.aborted) {
          throw error;
        }
      })
      .finally(() => {
        sourceSignal?.removeEventListener("abort", abortFromSource);
        if (this.activeCleanupController === controller) {
          this.activeCleanupController = null;
          this.activeCleanupPromise = Promise.resolve();
        }
      });
    this.activeCleanupPromise = cleanup;
    return cleanup;
  }

  private async removeUserWithSignal(
    options: AuthStorageClearOptions,
    signal: AbortSignal
  ): Promise<void> {
    throwIfAborted(signal);
    const shouldClearOfflineVaultTables =
      options.clearOfflineVaultTables ?? true;
    const shouldForceVaultTableCleanup =
      options.clearOfflineVaultTables === true &&
      options.allowBarrierSkipUpgrade !== true;
    const hasLogoutBarrier = this.hasLogoutBarrier();
    const shouldHonorBarrierSkipUpgrade =
      options.allowBarrierSkipUpgrade === true;
    const cleanupPromise =
      shouldClearOfflineVaultTables &&
      !hasLogoutBarrier &&
      !shouldHonorBarrierSkipUpgrade
        ? this.clearVaultTables(signal).then(
            () => ({ status: "completed" as const }),
            (error: unknown) => ({ status: "failed" as const, error })
          )
        : null;

    this.clearStoredUserMarkers();
    throwIfAborted(signal);
    clearActiveOfflineVaultSession();
    clearRecentAuthVaultKeyMaterials();

    if (!shouldClearOfflineVaultTables) {
      return;
    }

    if (shouldHonorBarrierSkipUpgrade || hasLogoutBarrier) {
      await this.waitForBarrierCleanupUpgrade();
      throwIfAborted(signal);

      if (
        !shouldForceVaultTableCleanup &&
        this.hasLogoutBarrier() &&
        this.shouldSkipBarrierVaultTableCleanup()
      ) {
        return;
      }
    }

    try {
      const cleanupResult = cleanupPromise
        ? await cleanupPromise
        : await this.clearVaultTables(signal).then(() => ({
            status: "completed" as const,
          }));

      if (cleanupResult.status === "failed") {
        throw cleanupResult.error;
      }
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw error;
      }

      console.warn("Failed to clear offline vault tables on logout:", error);
    }
  }

  async clear(options?: AuthStorageClearOptions): Promise<void> {
    this.activePersistenceController?.abort();
    const shouldPreserveExistingSkipMarker =
      this.hasLogoutBarrier() && this.shouldSkipBarrierVaultTableCleanup();

    if (!shouldPreserveExistingSkipMarker) {
      this.clearSensitiveLogoutBarrierCleanupOwners();
    }

    this.setLogoutBarrier();
    this.setSkipBarrierVaultTableCleanup(
      shouldPreserveExistingSkipMarker ||
        options?.clearOfflineVaultTables === false
    );
    await this.removeUser({
      ...options,
      allowBarrierSkipUpgrade:
        options?.allowBarrierSkipUpgrade ??
        options?.clearOfflineVaultTables !== false,
    });
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
