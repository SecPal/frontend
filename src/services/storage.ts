// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import {
  AUTH_VAULT_STORAGE_KEY,
  AUTH_VAULT_LOCK_KEY,
} from "../lib/offlineVaultKeys";
import {
  createRecoverableLazyModuleError,
  isRecoverableLazyModuleError,
  isTransientModuleLoadError,
} from "../lib/lazyModuleErrors";
import { clearActiveOfflineVaultSession } from "../lib/offlineVaultRuntime";
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
  hasVaultLock(): boolean;
  getUserSnapshot(): User | null;
  getUser(): Promise<User | null>;
  setUser(user: User): Promise<void>;
  lockVault(): void;
  unlockVault(): Promise<User | null>;
  removeUser(options?: AuthStorageClearOptions): Promise<void>;
  clear(options?: AuthStorageClearOptions): Promise<void>;
  hasLogoutBarrier(): boolean;
  shouldSkipBarrierVaultTableCleanup(): boolean;
  setSkipBarrierVaultTableCleanup(shouldSkip: boolean): void;
  beginSensitiveLogoutBarrierCleanup(): string;
  endSensitiveLogoutBarrierCleanup(ownerToken: string): void;
  completeStaleSensitiveLogoutBarrierCleanup(ownerToken: string): void;
  waitForInFlightVaultTableCleanup(): Promise<void>;
}

interface AuthStorageClearOptions {
  clearOfflineVaultTables?: boolean;
  allowBarrierSkipUpgrade?: boolean;
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
  private vaultTableCleanupQueuePromise: Promise<void> = Promise.resolve();

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
    localStorage.setItem(this.LOGOUT_BARRIER_KEY, "1");
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
    const ownerToken = crypto.randomUUID();

    if (!hasActiveSkipBarrier) {
      this.clearSensitiveLogoutBarrierCleanupOwners();
    }

    this.setLogoutBarrier();
    localStorage.setItem(
      this.getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken),
      "1"
    );
    this.setSkipBarrierVaultTableCleanup(true);

    return ownerToken;
  }

  endSensitiveLogoutBarrierCleanup(ownerToken: string): void {
    localStorage.removeItem(
      this.getSensitiveLogoutBarrierCleanupOwnerKey(ownerToken)
    );

    if (this.hasSensitiveLogoutBarrierCleanupOwners()) {
      return;
    }

    this.setSkipBarrierVaultTableCleanup(false);
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
        this.vaultTableCleanupQueuePromise
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

  private async clearVaultTables(): Promise<void> {
    const offlineVaultModulePromise = loadOfflineVaultModule();
    const queuedCleanupPromise = this.vaultTableCleanupQueuePromise
      .catch(() => {
        // The cleanup initiator handles the vault-table failure; later
        // cleanups still need to run in order.
      })
      .then(async () => {
        const { clearOfflineVaultTables } = await offlineVaultModulePromise;
        await clearOfflineVaultTables();
      });

    this.vaultTableCleanupQueuePromise = queuedCleanupPromise;
    await queuedCleanupPromise;
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
      (localStorage.getItem(this.VAULT_KEY) !== null ||
        hasStoredUserRecord(this.USER_KEY))
    );
  }

  private clearStoredUserMarkers(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.VAULT_KEY);
    localStorage.removeItem(this.VAULT_LOCK_KEY);
  }

  private clearInvalidStoredUser(): null {
    this.clearStoredUserMarkers();
    void this.removeUser({ allowBarrierSkipUpgrade: true });
    return null;
  }

  private async clearInvalidStoredUserAsync(): Promise<null> {
    this.clearStoredUserMarkers();
    await this.removeUser({ allowBarrierSkipUpgrade: true });
    return null;
  }

  private handleStoredUserError(message: string, error: unknown): null {
    console.error(message, error);
    return this.clearInvalidStoredUser();
  }

  private async handleStoredUserErrorAsync(
    message: string,
    error: unknown
  ): Promise<null> {
    console.error(message, error);
    return this.clearInvalidStoredUserAsync();
  }

  getUserSnapshot(): User | null {
    if (this.hasLogoutBarrier()) {
      void this.removeUser({
        clearOfflineVaultTables: !this.shouldSkipBarrierVaultTableCleanup(),
        allowBarrierSkipUpgrade: true,
      });
      return null;
    }

    if (this.hasVaultLock()) {
      return null;
    }

    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      return null;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);

    if (!storedUser) {
      return null;
    }

    try {
      const parsedStoredUser = JSON.parse(storedUser) as unknown;

      if (!isAuthStorageEnvelope(parsedStoredUser)) {
        return this.clearInvalidStoredUser();
      }

      return null;
    } catch (error) {
      return this.handleStoredUserError(
        "Failed to parse stored user snapshot:",
        error
      );
    }
  }

  async getUser(): Promise<User | null> {
    if (this.hasLogoutBarrier()) {
      void this.removeUser({
        clearOfflineVaultTables: !this.shouldSkipBarrierVaultTableCleanup(),
        allowBarrierSkipUpgrade: true,
      });
      return null;
    }

    if (this.hasVaultLock()) {
      return null;
    }

    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      let readPersistedAuthUserFromVault: typeof import("../lib/offlineVault").readPersistedAuthUserFromVault;

      try {
        ({ readPersistedAuthUserFromVault } = await loadOfflineVaultModule());
      } catch (error) {
        if (isTransientModuleLoadError(error)) {
          throw createRecoverableLazyModuleError(
            "Stored offline auth data is temporarily unavailable on this device.",
            error
          );
        }

        throw error;
      }

      const storedVaultUser = await readPersistedAuthUserFromVault();

      if (!storedVaultUser) {
        return this.clearInvalidStoredUserAsync();
      }

      return storedVaultUser;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;

    try {
      const sanitizedUser = await decryptPersistedAuthUser(storedUser);

      if (!sanitizedUser) {
        return this.clearInvalidStoredUserAsync();
      }

      let initializeOfflineVault: typeof import("../lib/offlineVault").initializeOfflineVault;

      try {
        ({ initializeOfflineVault } = await loadOfflineVaultModule());
      } catch (error) {
        if (isTransientModuleLoadError(error)) {
          throw createRecoverableLazyModuleError(
            "Stored offline auth data is temporarily unavailable on this device.",
            error
          );
        }

        throw error;
      }

      await initializeOfflineVault(sanitizedUser);

      return sanitizedUser;
    } catch (error) {
      if (isRecoverableLazyModuleError(error)) {
        throw error;
      }

      return this.handleStoredUserErrorAsync(
        "Failed to parse stored user data:",
        error
      );
    }
  }

  async setUser(user: User): Promise<void> {
    const sanitizedUser = sanitizePersistedAuthUser(user);

    if (!sanitizedUser) {
      await this.removeUser();
      return;
    }

    try {
      const { initializeOfflineVault } = await loadOfflineVaultModule();
      await initializeOfflineVault(sanitizedUser);
    } catch (error) {
      console.error("Failed to persist stored user data:", error);
      await this.removeUser({ allowBarrierSkipUpgrade: true });
      return;
    }

    this.clearLogoutBarrier();
    localStorage.removeItem(this.VAULT_LOCK_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  lockVault(): void {
    this.clearLogoutBarrier();
    if (localStorage.getItem(this.VAULT_KEY) !== null) {
      localStorage.setItem(this.VAULT_LOCK_KEY, "1");
    }
    localStorage.removeItem(this.USER_KEY);
    clearActiveOfflineVaultSession();
  }

  async unlockVault(): Promise<User | null> {
    localStorage.removeItem(this.VAULT_LOCK_KEY);

    const unlockedUser = await this.getUser();

    if (!unlockedUser) {
      await this.removeUser();
      return null;
    }

    return unlockedUser;
  }

  async removeUser(options: AuthStorageClearOptions = {}): Promise<void> {
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
        ? this.clearVaultTables()
        : null;

    this.clearStoredUserMarkers();
    const { clearOfflineVaultSession, clearRecentAuthVaultKeyMaterials } =
      await loadOfflineVaultModule();
    clearOfflineVaultSession();
    clearRecentAuthVaultKeyMaterials();

    if (!shouldClearOfflineVaultTables) {
      return;
    }

    if (shouldHonorBarrierSkipUpgrade || hasLogoutBarrier) {
      await this.waitForBarrierCleanupUpgrade();

      if (
        !shouldForceVaultTableCleanup &&
        this.hasLogoutBarrier() &&
        this.shouldSkipBarrierVaultTableCleanup()
      ) {
        return;
      }
    }

    try {
      await (cleanupPromise ?? this.clearVaultTables());
    } catch (error: unknown) {
      console.warn("Failed to clear offline vault tables on logout:", error);
    }
  }

  async clear(options?: AuthStorageClearOptions): Promise<void> {
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
