// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";
import { sanitizePersistedAuthUser, type PersistedAuthUser } from "./authState";
import { getCsrfTokenFromCookie } from "./csrf";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const AUTH_STORAGE_LEGACY_VERSION = 1;
const AUTH_STORAGE_VERSION = 2;
const AUTH_STORAGE_LEGACY_PBKDF2_ITERATIONS = 5_000;
const AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_SALT_BYTES = 16;
const AUTH_STORAGE_IV_BYTES = 16;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

type AuthStorageVersion =
  | typeof AUTH_STORAGE_LEGACY_VERSION
  | typeof AUTH_STORAGE_VERSION;

interface AuthStorageEnvelope {
  scheme: typeof AUTH_STORAGE_SCHEME;
  version: AuthStorageVersion;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

function isAuthStorageVersion(value: unknown): value is AuthStorageVersion {
  return (
    value === AUTH_STORAGE_LEGACY_VERSION || value === AUTH_STORAGE_VERSION
  );
}

function getAuthStorageIterations(version: AuthStorageVersion): number {
  return version === AUTH_STORAGE_LEGACY_VERSION
    ? AUTH_STORAGE_LEGACY_PBKDF2_ITERATIONS
    : AUTH_STORAGE_PBKDF2_ITERATIONS;
}

function getAuthStorageKeyMaterial(): string | null {
  const csrfToken = getCsrfTokenFromCookie();

  if (!csrfToken) {
    return null;
  }

  return `secpal-auth-storage:${csrfToken}`;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
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

async function signEnvelopeMac(
  envelope: Omit<AuthStorageEnvelope, "mac">,
  macKey: CryptoKey
): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    macKey,
    textEncoder.encode(buildEnvelopeMacPayload(envelope))
  );

  return encodeBase64(new Uint8Array(mac));
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

async function encryptAuthPayload(
  plaintext: string,
  encryptionKey: CryptoKey,
  iv: Uint8Array
): Promise<Uint8Array> {
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: toArrayBuffer(iv),
    },
    encryptionKey,
    textEncoder.encode(plaintext)
  );

  return new Uint8Array(ciphertext);
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

function createRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function encryptPersistedAuthUser(
  user: PersistedAuthUser
): Promise<string | null> {
  const keyMaterial = getAuthStorageKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const salt = createRandomBytes(AUTH_STORAGE_SALT_BYTES);
  const iv = createRandomBytes(AUTH_STORAGE_IV_BYTES);
  const { encryptionKey, macKey } = await deriveAuthStorageKeys(
    keyMaterial,
    salt,
    getAuthStorageIterations(AUTH_STORAGE_VERSION)
  );
  const ciphertext = await encryptAuthPayload(
    JSON.stringify(user),
    encryptionKey,
    iv
  );

  const envelopeWithoutMac = {
    scheme: AUTH_STORAGE_SCHEME,
    version: AUTH_STORAGE_VERSION,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  } satisfies Omit<AuthStorageEnvelope, "mac">;

  return JSON.stringify({
    ...envelopeWithoutMac,
    mac: await signEnvelopeMac(envelopeWithoutMac, macKey),
  });
}

function buildEnvelopeMacPayload(
  envelope: Omit<AuthStorageEnvelope, "mac">
): string {
  return [
    envelope.scheme,
    String(envelope.version),
    envelope.salt,
    envelope.iv,
    envelope.ciphertext,
  ].join(".");
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
    return sanitizePersistedAuthUser(parsedStoredUser);
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
    getAuthStorageIterations(parsedStoredUser.version)
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
  getUserSnapshot(): User | null;
  getUser(): Promise<User | null>;
  setUser(user: User): Promise<void>;
  removeUser(): void;
  clear(): void;
  hasLogoutBarrier(): boolean;
}

/**
 * LocalStorage implementation of AuthStorage
 */
class LocalStorageAuthStorage implements AuthStorage {
  private readonly USER_KEY = "auth_user";
  private readonly LOGOUT_BARRIER_KEY = "auth_logout_barrier";

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

  hasLogoutBarrier(): boolean {
    return localStorage.getItem(this.LOGOUT_BARRIER_KEY) !== null;
  }

  hasStoredUser(): boolean {
    return !this.hasLogoutBarrier() && hasStoredUserRecord(this.USER_KEY);
  }

  private clearInvalidStoredUser(): null {
    this.removeUser();
    return null;
  }

  private handleStoredUserError(message: string, error: unknown): null {
    console.error(message, error);
    return this.clearInvalidStoredUser();
  }

  getUserSnapshot(): User | null {
    if (this.hasLogoutBarrier()) {
      this.removeUser();
      return null;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);

    if (!storedUser) {
      return null;
    }

    try {
      const parsedStoredUser = JSON.parse(storedUser) as unknown;

      if (isAuthStorageEnvelope(parsedStoredUser)) {
        return null;
      }

      const sanitizedUser = sanitizePersistedAuthUser(parsedStoredUser);

      if (!sanitizedUser) {
        return this.clearInvalidStoredUser();
      }

      return sanitizedUser;
    } catch (error) {
      return this.handleStoredUserError(
        "Failed to parse stored user snapshot:",
        error
      );
    }
  }

  async getUser(): Promise<User | null> {
    if (this.hasLogoutBarrier()) {
      this.removeUser();
      return null;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;

    try {
      const sanitizedUser = await decryptPersistedAuthUser(storedUser);

      if (!sanitizedUser) {
        return this.clearInvalidStoredUser();
      }

      return sanitizedUser;
    } catch (error) {
      return this.handleStoredUserError(
        "Failed to parse stored user data:",
        error
      );
    }
  }

  async setUser(user: User): Promise<void> {
    const sanitizedUser = sanitizePersistedAuthUser(user);

    if (!sanitizedUser) {
      this.removeUser();
      return;
    }

    let encryptedUser: string | null;

    try {
      encryptedUser = await encryptPersistedAuthUser(sanitizedUser);
    } catch (error) {
      console.error("Failed to persist stored user data:", error);
      this.removeUser();
      return;
    }

    if (!encryptedUser) {
      console.warn(
        "Failed to derive auth storage key due to missing CSRF token/session context; clearing persisted auth state."
      );
      this.removeUser();
      return;
    }

    this.clearLogoutBarrier();
    localStorage.setItem(this.USER_KEY, encryptedUser);
  }

  removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  clear(): void {
    this.setLogoutBarrier();
    this.removeUser();
  }
}

/**
 * Default auth storage instance
 * Can be replaced with a mock for testing (Dependency Inversion Principle)
 */
export const authStorage: AuthStorage = new LocalStorageAuthStorage();
