// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * AES-GCM-256 File Encryption Module
 *
 * This module provides zero-knowledge client-side file encryption using:
 * - AES-GCM-256 for authenticated encryption
 * - HKDF-SHA-256 for file-specific key derivation
 * - Web Crypto API for all cryptographic operations
 *
 * @module lib/crypto/encryption
 */

/**
 * Encrypted file result containing ciphertext, IV, and authentication tag
 */
export interface EncryptedFile {
  /** Encrypted file data */
  ciphertext: Uint8Array;
  /** Initialization vector (96 bits / 12 bytes) */
  iv: Uint8Array;
  /** Authentication tag (128 bits / 16 bytes) */
  authTag: Uint8Array;
}

/**
 * Generate a new 256-bit AES-GCM master key
 *
 * @returns Promise resolving to CryptoKey (extractable, usages: encrypt, decrypt)
 * @throws {Error} If key generation fails
 */
export async function generateMasterKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256, // 256-bit key
    },
    true, // extractable (needed for export/storage)
    ["encrypt", "decrypt"]
  );
}

/**
 * Export master key as raw bytes for storage
 *
 * @param masterKey - CryptoKey to export
 * @returns Promise resolving to 32-byte Uint8Array
 * @throws {Error} If key export fails or key is not extractable
 */
export async function exportMasterKey(
  masterKey: CryptoKey
): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey("raw", masterKey);
  return new Uint8Array(exported);
}

/**
 * Import raw master key bytes as CryptoKey
 *
 * @param keyBytes - 32-byte Uint8Array containing raw key material
 * @returns Promise resolving to CryptoKey (extractable, usages: encrypt, decrypt)
 * @throws {Error} If key import fails or key length is invalid
 */
export async function importMasterKey(
  keyBytes: Uint8Array
): Promise<CryptoKey> {
  if (keyBytes.length !== 32) {
    throw new Error(
      `Invalid master key length: expected 32 bytes, got ${keyBytes.length}`
    );
  }

  return await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Derive a file-specific encryption key using HKDF-SHA-256
 *
 * Uses the filename as salt to ensure each file has a unique encryption key,
 * preventing cross-file attacks even if master key is compromised.
 *
 * @param masterKey - Master encryption key
 * @param filename - Original filename (used as salt for key derivation)
 * @returns Promise resolving to derived CryptoKey
 * @throws {Error} If key derivation fails
 */
export async function deriveFileKey(
  masterKey: CryptoKey,
  filename: string
): Promise<CryptoKey> {
  // Export master key to use as input key material
  const masterKeyBytes = await crypto.subtle.exportKey("raw", masterKey);

  // Import as HKDF base key
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    masterKeyBytes,
    "HKDF",
    false, // not extractable
    ["deriveKey"]
  );

  // Use filename as salt (encoded as UTF-8)
  const salt = new TextEncoder().encode(filename);

  // Derive file-specific AES-GCM key
  return await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: new Uint8Array(0), // No additional info needed
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // not extractable (file keys are ephemeral)
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a file using AES-GCM-256
 *
 * @param plaintext - File data to encrypt
 * @param fileKey - File-specific encryption key (from deriveFileKey)
 * @returns Promise resolving to EncryptedFile containing ciphertext, IV, and auth tag
 * @throws {Error} If encryption fails
 */
export async function encryptFile(
  plaintext: Uint8Array,
  fileKey: CryptoKey
): Promise<EncryptedFile> {
  // Generate random IV (96 bits / 12 bytes)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt using AES-GCM
  // tagLength: 128 bits (default, provides 128-bit authentication)
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128, // 128-bit authentication tag
    },
    fileKey,
    plaintext as BufferSource
  );

  // AES-GCM output contains ciphertext + auth tag concatenated
  const encryptedArray = new Uint8Array(encrypted);
  const authTagLength = 16; // 128 bits = 16 bytes

  // Split ciphertext and auth tag
  const ciphertext = encryptedArray.slice(
    0,
    encryptedArray.length - authTagLength
  );
  const authTag = encryptedArray.slice(encryptedArray.length - authTagLength);

  return {
    ciphertext,
    iv,
    authTag,
  };
}

/**
 * Decrypt a file using AES-GCM-256
 *
 * @param ciphertext - Encrypted file data
 * @param fileKey - File-specific encryption key (from deriveFileKey)
 * @param iv - Initialization vector (96 bits / 12 bytes)
 * @param authTag - Authentication tag (128 bits / 16 bytes)
 * @returns Promise resolving to decrypted plaintext
 * @throws {Error} If decryption fails or authentication tag is invalid
 */
export async function decryptFile(
  ciphertext: Uint8Array,
  fileKey: CryptoKey,
  iv: Uint8Array,
  authTag: Uint8Array
): Promise<Uint8Array> {
  // Validate inputs
  if (iv.length !== 12) {
    throw new Error(`Invalid IV length: expected 12 bytes, got ${iv.length}`);
  }
  if (authTag.length !== 16) {
    throw new Error(
      `Invalid auth tag length: expected 16 bytes, got ${authTag.length}`
    );
  }

  // Concatenate ciphertext and auth tag (Web Crypto API expects them together)
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  // Decrypt using AES-GCM
  // Will throw if authentication fails (tampered data)
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv as BufferSource,
      tagLength: 128,
    },
    fileKey,
    combined as BufferSource
  );

  return new Uint8Array(decrypted);
}
