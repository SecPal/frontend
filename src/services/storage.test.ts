// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnvelopeMacPayload } from "./authStorageEnvelope";
import { authStorage } from "./storage";
import {
  AUTH_VAULT_STORAGE_KEY,
  clearOfflineVaultSession,
} from "../lib/offlineVault";
import { db } from "../lib/db";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const LEGACY_AUTH_STORAGE_VERSION = 1;
const CURRENT_AUTH_STORAGE_VERSION = 2;
const LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS = 5_000;
const CURRENT_AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;
const textEncoder = new TextEncoder();

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

  it("locks the offline vault without deleting encrypted records and restores them after unlock", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);

    authStorage.lockVault();

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(authStorage.hasVaultLock()).toBe(true);

    await expect(authStorage.unlockVault()).resolves.toEqual(user);
    expect(authStorage.hasVaultLock()).toBe(false);
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("clears auth state when unlockVault finds no readable user after removing the lock", async () => {
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

    await expect(authStorage.unlockVault()).resolves.toBeNull();
    expect(authStorage.hasStoredUser()).toBe(false);
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

  it("clears invalid JSON snapshots and logs the parse failure", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    localStorage.setItem("auth_user", "invalid-json");

    expect(authStorage.getUserSnapshot()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to parse stored user snapshot:",
      expect.any(SyntaxError)
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
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

    await expect(authStorage.setUser(user)).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to persist stored user data:",
      cryptoFailure
    );
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears persisted auth state when setUser receives an invalid user", async () => {
    localStorage.setItem("auth_user", "stale-auth-storage-record");

    await expect(
      authStorage.setUser({ email: "missing-id@secpal.dev" } as never)
    ).resolves.toBeUndefined();

    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("clears unsupported unencrypted auth snapshots", () => {
    const unsupportedStoredUser =
      '{"id":"1","name":"Legacy User","email":"legacy@secpal.dev","emailVerified":false}';

    localStorage.setItem("auth_user", unsupportedStoredUser);

    expect(authStorage.getUserSnapshot()).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
      expect(await db.vaultProfile.count()).toBe(1);
    } finally {
      await db.vaultProfile.clear();
    }
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
});
