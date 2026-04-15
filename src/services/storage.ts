// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import CryptoJS from "crypto-js";
import type { User } from "../contexts/auth-context";
import { sanitizePersistedAuthUser, type PersistedAuthUser } from "./authState";
import { getCsrfTokenFromCookie } from "./csrf";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const AUTH_STORAGE_VERSION = 1;
const AUTH_STORAGE_PBKDF2_ITERATIONS = 5_000;
const AUTH_STORAGE_SALT_BYTES = 16;
const AUTH_STORAGE_IV_BYTES = 16;
const AUTH_STORAGE_KEY_SIZE_WORDS = 16;
const AUTH_STORAGE_HALF_KEY_SIG_BYTES = 32;

interface AuthStorageEnvelope {
  scheme: typeof AUTH_STORAGE_SCHEME;
  version: typeof AUTH_STORAGE_VERSION;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

function getAuthStorageKeyMaterial(): string | null {
  const csrfToken = getCsrfTokenFromCookie();

  if (!csrfToken) {
    return null;
  }

  return `secpal-auth-storage:${csrfToken}`;
}

function splitDerivedKey(derivedKey: CryptoJS.lib.WordArray): {
  encryptionKey: CryptoJS.lib.WordArray;
  macKey: CryptoJS.lib.WordArray;
} {
  return {
    encryptionKey: CryptoJS.lib.WordArray.create(
      derivedKey.words.slice(0, 8),
      AUTH_STORAGE_HALF_KEY_SIG_BYTES
    ),
    macKey: CryptoJS.lib.WordArray.create(
      derivedKey.words.slice(8, 16),
      AUTH_STORAGE_HALF_KEY_SIG_BYTES
    ),
  };
}

function deriveAuthStorageKeys(
  keyMaterial: string,
  salt: CryptoJS.lib.WordArray
): { encryptionKey: CryptoJS.lib.WordArray; macKey: CryptoJS.lib.WordArray } {
  const derivedKey = CryptoJS.PBKDF2(keyMaterial, salt, {
    hasher: CryptoJS.algo.SHA256,
    iterations: AUTH_STORAGE_PBKDF2_ITERATIONS,
    keySize: AUTH_STORAGE_KEY_SIZE_WORDS,
  });

  return splitDerivedKey(derivedKey);
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
    candidate.version === AUTH_STORAGE_VERSION &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.mac === "string"
  );
}

function encryptPersistedAuthUser(user: PersistedAuthUser): string | null {
  const keyMaterial = getAuthStorageKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const salt = CryptoJS.lib.WordArray.random(AUTH_STORAGE_SALT_BYTES);
  const iv = CryptoJS.lib.WordArray.random(AUTH_STORAGE_IV_BYTES);
  const { encryptionKey, macKey } = deriveAuthStorageKeys(keyMaterial, salt);
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(user), encryptionKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext;

  const envelopeWithoutMac = {
    scheme: AUTH_STORAGE_SCHEME,
    version: AUTH_STORAGE_VERSION,
    salt: salt.toString(CryptoJS.enc.Base64),
    iv: iv.toString(CryptoJS.enc.Base64),
    ciphertext: ciphertext.toString(CryptoJS.enc.Base64),
  } satisfies Omit<AuthStorageEnvelope, "mac">;

  return JSON.stringify({
    ...envelopeWithoutMac,
    mac: CryptoJS.HmacSHA256(
      buildEnvelopeMacPayload(envelopeWithoutMac),
      macKey
    ).toString(CryptoJS.enc.Base64),
  } satisfies AuthStorageEnvelope);
}

function decryptPersistedAuthUser(
  storedUser: string
): PersistedAuthUser | null {
  const parsedStoredUser = JSON.parse(storedUser) as unknown;

  if (!isAuthStorageEnvelope(parsedStoredUser)) {
    return sanitizePersistedAuthUser(parsedStoredUser);
  }

  const keyMaterial = getAuthStorageKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const salt = CryptoJS.enc.Base64.parse(parsedStoredUser.salt);
  const { encryptionKey, macKey } = deriveAuthStorageKeys(keyMaterial, salt);
  const expectedMac = CryptoJS.HmacSHA256(
    buildEnvelopeMacPayload({
      scheme: parsedStoredUser.scheme,
      version: parsedStoredUser.version,
      salt: parsedStoredUser.salt,
      iv: parsedStoredUser.iv,
      ciphertext: parsedStoredUser.ciphertext,
    }),
    macKey
  ).toString(CryptoJS.enc.Base64);

  if (expectedMac !== parsedStoredUser.mac) {
    return null;
  }

  const decryptedUser = CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(parsedStoredUser.ciphertext),
    }),
    encryptionKey,
    {
      iv: CryptoJS.enc.Base64.parse(parsedStoredUser.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    }
  ).toString(CryptoJS.enc.Utf8);

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
  getUser(): User | null;
  setUser(user: User): void;
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

  getUser(): User | null {
    if (this.hasLogoutBarrier()) {
      this.removeUser();
      return null;
    }

    const storedUser = localStorage.getItem(this.USER_KEY);
    if (!storedUser) return null;

    try {
      const sanitizedUser = decryptPersistedAuthUser(storedUser);

      if (!sanitizedUser) {
        this.removeUser();
        return null;
      }

      return sanitizedUser;
    } catch (error) {
      console.error("Failed to parse stored user data:", error);
      this.removeUser();
      return null;
    }
  }

  setUser(user: User): void {
    const sanitizedUser = sanitizePersistedAuthUser(user);

    if (!sanitizedUser) {
      this.removeUser();
      return;
    }

    const encryptedUser = encryptPersistedAuthUser(sanitizedUser);

    if (!encryptedUser) {
      console.warn(
        "Failed to derive session-bound auth storage key; clearing persisted auth state."
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
