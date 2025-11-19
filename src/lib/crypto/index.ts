// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Crypto Module Public API
 *
 * This module provides zero-knowledge client-side file encryption
 * and integrity verification for SecPal.
 *
 * @module lib/crypto
 */

// Encryption
export {
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
  deriveFileKey,
  encryptFile,
  decryptFile,
} from "./encryption";
export type { EncryptedFile } from "./encryption";

// Checksums
export { calculateChecksum, verifyChecksum } from "./checksum";

// Test Vectors (for testing only)
export {
  SIMPLE_TEST_VECTOR,
  EMPTY_TEST_VECTOR,
  LARGE_TEST_VECTOR,
  HKDF_TEST_VECTOR,
  CHECKSUM_TEST_VECTORS,
  toHex,
  fromHex,
} from "./testVectors";
