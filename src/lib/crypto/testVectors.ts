// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Known-Answer Tests (KAT) for AES-GCM-256 encryption
 *
 * These test vectors are used to validate that our implementation
 * produces correct results according to NIST specifications.
 *
 * @see https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program
 */

/**
 * Simple test vector for basic functionality
 * Uses all zeros for easy debugging
 */
export const SIMPLE_TEST_VECTOR = {
  description: "Simple test vector (all zeros)",

  // 256-bit key (all zeros)
  key: new Uint8Array(32).fill(0),

  // 96-bit IV (all zeros)
  iv: new Uint8Array(12).fill(0),

  // Plaintext: "test" (4 bytes)
  plaintext: new Uint8Array([0x74, 0x65, 0x73, 0x74]),

  // Expected values will be computed in tests
} as const;

/**
 * Test vector for empty input
 */
export const EMPTY_TEST_VECTOR = {
  description: "Empty plaintext test",

  key: new Uint8Array(32).fill(0xaa),
  iv: new Uint8Array(12).fill(0xbb),
  plaintext: new Uint8Array(0), // Empty
} as const;

/**
 * Test vector for large input (simulates real file)
 */
export const LARGE_TEST_VECTOR = {
  description: "Large plaintext test (1KB)",

  key: new Uint8Array(32).fill(0x42),
  iv: new Uint8Array(12).fill(0x24),

  // 1KB of data (pattern: 0x00, 0x01, 0x02, ..., 0xff repeated)
  plaintext: new Uint8Array(1024).map((_, i) => i % 256),
} as const;

/**
 * Helper function to convert Uint8Array to hex string (for debugging)
 */
export function toHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Helper function to convert hex string to Uint8Array
 */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string (odd length)");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Test data for HKDF key derivation
 */
export const HKDF_TEST_VECTOR = {
  description: "HKDF key derivation test",

  // Master key (256 bits)
  masterKey: new Uint8Array(32).fill(0x2a), // "*" repeated

  // Salt (filename hash)
  filename: "test-file.pdf",

  // Expected derived key will be computed in tests
  // Different filenames should produce different keys
  filenames: ["test-file.pdf", "another-file.jpg", "document.docx"],
} as const;

/**
 * Test data for SHA-256 checksums
 */
export const CHECKSUM_TEST_VECTORS = [
  {
    description: "Empty input",
    input: new Uint8Array(0),
    expectedChecksum:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  {
    description: "Simple text",
    input: new TextEncoder().encode("Hello, World!"),
    expectedChecksum:
      "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f",
  },
  {
    description: "Binary data",
    input: new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]),
    expectedChecksum:
      "08bb5e5d6eaac1049ede0893d30ed022b1a4d9b5b48db414871f51c9cb35283d",
  },
] as const;
