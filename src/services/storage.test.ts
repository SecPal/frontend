// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnvelopeMacPayload } from "./authStorageEnvelope";
import { authStorage } from "./storage";

const LEGACY_AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const LEGACY_AUTH_STORAGE_VERSION = 1;
const LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS = 5_000;
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

async function createLegacyEncryptedEnvelope(
  user: Record<string, unknown>,
  csrfToken: string
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
      iterations: LEGACY_AUTH_STORAGE_PBKDF2_ITERATIONS,
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
      textEncoder.encode(JSON.stringify(user))
    )
  );
  const envelopeWithoutMac = {
    scheme: LEGACY_AUTH_STORAGE_SCHEME,
    version: LEGACY_AUTH_STORAGE_VERSION,
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
    setCsrfTokenCookie("test-csrf-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("encrypts persisted auth state before writing to localStorage", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
      employeeStatus: "pre_contract" as const,
      onboardingWorkflowStatus: "submitted_for_review" as const,
    };

    await authStorage.setUser(user);

    const storedUser = localStorage.getItem("auth_user");

    expect(storedUser).not.toBeNull();
    const parsedStoredUser = JSON.parse(storedUser as string) as Record<
      string,
      unknown
    >;

    expect(parsedStoredUser).toEqual(
      expect.objectContaining({
        scheme: expect.any(String),
        version: expect.anything(),
        salt: expect.any(String),
        iv: expect.any(String),
        ciphertext: expect.any(String),
        mac: expect.any(String),
      })
    );
    expect(parsedStoredUser.salt).not.toBe("");
    expect(parsedStoredUser.iv).not.toBe("");
    expect(parsedStoredUser.ciphertext).not.toBe("");
    expect(parsedStoredUser.mac).not.toBe("");
    await expect(authStorage.getUser()).resolves.toEqual(user);
  });

  it("clears encrypted auth state when the session-derived key material changes", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);
    setCsrfTokenCookie("rotated-csrf-token");

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
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
      await createLegacyEncryptedEnvelope(legacyUser, "test-csrf-token")
    );

    await expect(authStorage.getUser()).resolves.toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });
});
