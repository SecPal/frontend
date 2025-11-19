// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * SHA-256 Checksum Module
 *
 * Provides file integrity verification using SHA-256 checksums.
 * Checksums are calculated on:
 * - Original plaintext (before encryption)
 * - Encrypted ciphertext (after encryption)
 *
 * This allows verification of:
 * - Plaintext integrity before encryption
 * - Ciphertext integrity during transit/storage
 * - Decrypted plaintext integrity after decryption
 *
 * @module lib/crypto/checksum
 */

/**
 * Calculate SHA-256 checksum of data
 *
 * @param data - Binary data to hash
 * @returns Promise resolving to hex-encoded SHA-256 checksum (64 characters)
 * @throws {Error} If hashing fails
 */
export async function calculateChecksum(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    data as BufferSource
  );
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  return Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify data integrity by comparing checksums
 *
 * @param data - Binary data to verify
 * @param expectedChecksum - Expected SHA-256 checksum (hex string, case-insensitive)
 * @returns Promise resolving to true if checksums match, false otherwise
 * @throws {Error} If checksum calculation fails
 */
export async function verifyChecksum(
  data: Uint8Array,
  expectedChecksum: string
): Promise<boolean> {
  // Validate checksum format (64 hex characters)
  const checksumRegex = /^[0-9a-fA-F]{64}$/;
  if (!checksumRegex.test(expectedChecksum)) {
    return false;
  }

  const actualChecksum = await calculateChecksum(data);

  // Case-insensitive comparison
  return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
}
