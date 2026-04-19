// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Page } from "@playwright/test";

const AUTH_STORAGE_SCHEME = "pbkdf2-aes-cbc-hmac-sha256";
const AUTH_STORAGE_VERSION = 2;
const AUTH_STORAGE_PBKDF2_ITERATIONS = 600_000;
const AUTH_STORAGE_HALF_KEY_BYTES = 32;
const AUTH_STORAGE_DERIVED_KEY_BYTES = AUTH_STORAGE_HALF_KEY_BYTES * 2;

const storedAuthUserCache = new Map<string, Promise<string>>();

function encodeBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function getStoredAuthUserCacheKey(
  user: Record<string, unknown>,
  csrfToken: string
): string {
  return `${csrfToken}:${JSON.stringify(user)}`;
}

export function clearStoredAuthUserCache(): void {
  storedAuthUserCache.clear();
}

export async function getEncryptedStoredAuthUser(
  user: Record<string, unknown>,
  csrfToken: string
): Promise<string> {
  const cacheKey = getStoredAuthUserCacheKey(user, csrfToken);
  const cachedStoredAuthUser = storedAuthUserCache.get(cacheKey);

  if (cachedStoredAuthUser) {
    return await cachedStoredAuthUser;
  }

  const encryptedStoredAuthUserPromise = createEncryptedStoredAuthUser(
    user,
    csrfToken
  );
  storedAuthUserCache.set(cacheKey, encryptedStoredAuthUserPromise);

  try {
    return await encryptedStoredAuthUserPromise;
  } catch (error) {
    storedAuthUserCache.delete(cacheKey);
    throw error;
  }
}

async function createEncryptedStoredAuthUser(
  user: Record<string, unknown>,
  csrfToken: string
): Promise<string> {
  const textEncoder = new TextEncoder();
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
      iterations: AUTH_STORAGE_PBKDF2_ITERATIONS,
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
      ["encrypt"]
    ),
    crypto.subtle.importKey(
      "raw",
      macKeyBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
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
    scheme: AUTH_STORAGE_SCHEME,
    version: AUTH_STORAGE_VERSION,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  };
  const mac = await crypto.subtle.sign(
    "HMAC",
    macKey,
    textEncoder.encode(
      [
        envelopeWithoutMac.scheme,
        String(envelopeWithoutMac.version),
        envelopeWithoutMac.salt,
        envelopeWithoutMac.iv,
        envelopeWithoutMac.ciphertext,
      ].join(".")
    )
  );

  return JSON.stringify({
    ...envelopeWithoutMac,
    mac: encodeBase64(new Uint8Array(mac)),
  });
}

export async function installStoredAuthUser(
  page: Page,
  user: Record<string, unknown>,
  csrfToken: string
): Promise<void> {
  const storedUser = await getEncryptedStoredAuthUser(user, csrfToken);

  await page.addInitScript(
    ({ currentCsrfToken, encryptedUser }) => {
      document.cookie = `XSRF-TOKEN=${encodeURIComponent(currentCsrfToken)}; path=/`;
      window.localStorage.setItem("auth_user", encryptedUser);
    },
    {
      currentCsrfToken: csrfToken,
      encryptedUser: storedUser,
    }
  );
}
