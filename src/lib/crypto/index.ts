// SPDX-FileCopyrightText: 2025 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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
