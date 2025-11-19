// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import {
  encryptFile,
  decryptFile,
  deriveFileKey,
  generateMasterKey,
  exportMasterKey,
  importMasterKey,
} from "./encryption";
import {
  SIMPLE_TEST_VECTOR,
  EMPTY_TEST_VECTOR,
  LARGE_TEST_VECTOR,
  HKDF_TEST_VECTOR,
} from "./testVectors";

describe("AES-GCM-256 Encryption", () => {
  describe("generateMasterKey", () => {
    it("should generate a 256-bit master key", async () => {
      const masterKey = await generateMasterKey();

      expect(masterKey).toBeInstanceOf(CryptoKey);
      expect(masterKey.type).toBe("secret");
      expect(masterKey.algorithm.name).toBe("AES-GCM");
      expect((masterKey.algorithm as AesKeyAlgorithm).length).toBe(256);
      expect(masterKey.extractable).toBe(true);
      expect(masterKey.usages).toContain("encrypt");
      expect(masterKey.usages).toContain("decrypt");
    });

    it("should generate different keys each time", async () => {
      const key1 = await generateMasterKey();
      const key2 = await generateMasterKey();

      const exported1 = await crypto.subtle.exportKey("raw", key1);
      const exported2 = await crypto.subtle.exportKey("raw", key2);

      expect(new Uint8Array(exported1)).not.toEqual(new Uint8Array(exported2));
    });
  });

  describe("exportMasterKey / importMasterKey", () => {
    it("should export and import master key correctly", async () => {
      const originalKey = await generateMasterKey();
      const exported = await exportMasterKey(originalKey);

      expect(exported).toBeInstanceOf(Uint8Array);
      expect(exported.length).toBe(32); // 256 bits

      const imported = await importMasterKey(exported);

      expect(imported).toBeInstanceOf(CryptoKey);
      expect(imported.algorithm.name).toBe("AES-GCM");
      expect((imported.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it("should maintain key material through export/import cycle", async () => {
      const originalKey = await generateMasterKey();
      const exported = await exportMasterKey(originalKey);
      const imported = await importMasterKey(exported);

      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encrypted1 = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        originalKey,
        testData
      );

      const encrypted2 = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        imported,
        testData
      );

      expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
    });
  });

  describe("deriveFileKey", () => {
    it("should derive a file-specific encryption key", async () => {
      const masterKeyBuffer = HKDF_TEST_VECTOR.masterKey;
      const masterKey = await importMasterKey(masterKeyBuffer);

      const fileKey = await deriveFileKey(masterKey, "test-file.pdf");

      expect(fileKey).toBeInstanceOf(CryptoKey);
      expect(fileKey.type).toBe("secret");
      expect(fileKey.algorithm.name).toBe("AES-GCM");
      expect((fileKey.algorithm as AesKeyAlgorithm).length).toBe(256);
    });

    it("should derive different keys for different filenames", async () => {
      const masterKeyBuffer = HKDF_TEST_VECTOR.masterKey;
      const masterKey = await importMasterKey(masterKeyBuffer);

      const keys = await Promise.all(
        HKDF_TEST_VECTOR.filenames.map((filename) =>
          deriveFileKey(masterKey, filename)
        )
      );

      // Cannot export non-extractable keys, so verify by encrypting same data
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const fixedIV = new Uint8Array(12).fill(0x42);

      const encrypted = await Promise.all(
        keys.map((key) =>
          crypto.subtle.encrypt({ name: "AES-GCM", iv: fixedIV }, key, testData)
        )
      );

      // All ciphertexts should be different (different keys)
      const cipher0 = encrypted[0];
      const cipher1 = encrypted[1];
      const cipher2 = encrypted[2];

      if (cipher0 && cipher1 && cipher2) {
        expect(new Uint8Array(cipher0)).not.toEqual(new Uint8Array(cipher1));
        expect(new Uint8Array(cipher1)).not.toEqual(new Uint8Array(cipher2));
        expect(new Uint8Array(cipher0)).not.toEqual(new Uint8Array(cipher2));
      }
    });
    it("should derive same key for same filename (deterministic)", async () => {
      const masterKeyBuffer = HKDF_TEST_VECTOR.masterKey;
      const masterKey = await importMasterKey(masterKeyBuffer);

      const key1 = await deriveFileKey(masterKey, "test-file.pdf");
      const key2 = await deriveFileKey(masterKey, "test-file.pdf");

      // Cannot export non-extractable keys, verify by encrypting same data
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const fixedIV = new Uint8Array(12).fill(0x42);

      const encrypted1 = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: fixedIV },
        key1,
        testData
      );
      const encrypted2 = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: fixedIV },
        key2,
        testData
      );

      // Same key should produce same ciphertext with same IV
      expect(new Uint8Array(encrypted1)).toEqual(new Uint8Array(encrypted2));
    });
  });

  describe("encryptFile", () => {
    it("should encrypt simple plaintext", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      const result = await encryptFile(SIMPLE_TEST_VECTOR.plaintext, fileKey);

      expect(result).toHaveProperty("ciphertext");
      expect(result).toHaveProperty("iv");
      expect(result).toHaveProperty("authTag");

      expect(result.ciphertext).toBeInstanceOf(Uint8Array);
      expect(result.iv).toBeInstanceOf(Uint8Array);
      expect(result.authTag).toBeInstanceOf(Uint8Array);

      expect(result.iv.length).toBe(12); // 96 bits
      expect(result.authTag.length).toBe(16); // 128 bits
    });

    it("should handle empty plaintext", async () => {
      const key = await importMasterKey(EMPTY_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "empty.txt");

      const result = await encryptFile(EMPTY_TEST_VECTOR.plaintext, fileKey);

      expect(result.ciphertext.length).toBe(0);
      expect(result.iv.length).toBe(12);
      expect(result.authTag.length).toBe(16);
    });

    it("should handle large files (1KB)", async () => {
      const key = await importMasterKey(LARGE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "large.bin");

      const result = await encryptFile(LARGE_TEST_VECTOR.plaintext, fileKey);

      expect(result.ciphertext.length).toBe(1024);
      expect(result.iv.length).toBe(12);
      expect(result.authTag.length).toBe(16);
    });

    it("should generate unique IV for each encryption", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      const result1 = await encryptFile(SIMPLE_TEST_VECTOR.plaintext, fileKey);
      const result2 = await encryptFile(SIMPLE_TEST_VECTOR.plaintext, fileKey);

      // IVs must be different
      expect(result1.iv).not.toEqual(result2.iv);

      // Ciphertexts should also be different (due to different IVs)
      expect(result1.ciphertext).not.toEqual(result2.ciphertext);
    });

    it("should produce deterministic auth tag for same IV", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      // Mock crypto.getRandomValues to return same IV
      const fixedIV = new Uint8Array(12).fill(0x42);
      vi.spyOn(crypto, "getRandomValues").mockReturnValue(fixedIV);

      const result1 = await encryptFile(SIMPLE_TEST_VECTOR.plaintext, fileKey);
      const result2 = await encryptFile(SIMPLE_TEST_VECTOR.plaintext, fileKey);

      expect(result1.iv).toEqual(result2.iv);
      expect(result1.ciphertext).toEqual(result2.ciphertext);
      expect(result1.authTag).toEqual(result2.authTag);

      vi.restoreAllMocks();
    });
  });

  describe("decryptFile", () => {
    it("should decrypt encrypted data correctly", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      const encrypted = await encryptFile(
        SIMPLE_TEST_VECTOR.plaintext,
        fileKey
      );

      const decrypted = await decryptFile(
        encrypted.ciphertext,
        fileKey,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toEqual(SIMPLE_TEST_VECTOR.plaintext);
    });

    it("should handle empty ciphertext", async () => {
      const key = await importMasterKey(EMPTY_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "empty.txt");

      const encrypted = await encryptFile(EMPTY_TEST_VECTOR.plaintext, fileKey);

      const decrypted = await decryptFile(
        encrypted.ciphertext,
        fileKey,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toEqual(EMPTY_TEST_VECTOR.plaintext);
    });

    it("should handle large files (1KB)", async () => {
      const key = await importMasterKey(LARGE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "large.bin");

      const encrypted = await encryptFile(LARGE_TEST_VECTOR.plaintext, fileKey);

      const decrypted = await decryptFile(
        encrypted.ciphertext,
        fileKey,
        encrypted.iv,
        encrypted.authTag
      );

      expect(decrypted).toEqual(LARGE_TEST_VECTOR.plaintext);
    });

    it("should fail if auth tag is tampered", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      const encrypted = await encryptFile(
        SIMPLE_TEST_VECTOR.plaintext,
        fileKey
      );

      // Tamper with auth tag
      const tamperedAuthTag = new Uint8Array(encrypted.authTag);
      if (tamperedAuthTag[0] !== undefined)
        if (tamperedAuthTag[0] !== undefined) tamperedAuthTag[0] ^= 0x01; // Flip one bit

      await expect(
        decryptFile(
          encrypted.ciphertext,
          fileKey,
          encrypted.iv,
          tamperedAuthTag
        )
      ).rejects.toThrow();
    });

    it("should fail if ciphertext is tampered", async () => {
      const key = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey = await deriveFileKey(key, "test.txt");

      const encrypted = await encryptFile(
        SIMPLE_TEST_VECTOR.plaintext,
        fileKey
      );

      // Tamper with ciphertext
      const tamperedCiphertext = new Uint8Array(encrypted.ciphertext);
      if (tamperedCiphertext.length > 0) {
        if (tamperedCiphertext[0] !== undefined)
          if (tamperedCiphertext[0] !== undefined)
            tamperedCiphertext[0] ^= 0x01; // Flip one bit
      }

      await expect(
        decryptFile(
          tamperedCiphertext,
          fileKey,
          encrypted.iv,
          encrypted.authTag
        )
      ).rejects.toThrow();
    });

    it("should fail with wrong decryption key", async () => {
      const key1 = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey1 = await deriveFileKey(key1, "test.txt");

      const encrypted = await encryptFile(
        SIMPLE_TEST_VECTOR.plaintext,
        fileKey1
      );

      // Try to decrypt with different key
      const key2 = await generateMasterKey();
      const fileKey2 = await deriveFileKey(key2, "test.txt");

      await expect(
        decryptFile(
          encrypted.ciphertext,
          fileKey2,
          encrypted.iv,
          encrypted.authTag
        )
      ).rejects.toThrow();
    });

    it("should fail with wrong filename (different derived key)", async () => {
      const masterKey = await importMasterKey(SIMPLE_TEST_VECTOR.key);
      const fileKey1 = await deriveFileKey(masterKey, "file1.txt");

      const encrypted = await encryptFile(
        SIMPLE_TEST_VECTOR.plaintext,
        fileKey1
      );

      // Try to decrypt with key derived from different filename
      const fileKey2 = await deriveFileKey(masterKey, "file2.txt");

      await expect(
        decryptFile(
          encrypted.ciphertext,
          fileKey2,
          encrypted.iv,
          encrypted.authTag
        )
      ).rejects.toThrow();
    });
  });

  describe("Round-trip encryption/decryption", () => {
    it("should maintain data integrity through encrypt/decrypt cycle", async () => {
      const testCases = [
        { name: "simple", data: SIMPLE_TEST_VECTOR.plaintext },
        { name: "empty", data: EMPTY_TEST_VECTOR.plaintext },
        { name: "large", data: LARGE_TEST_VECTOR.plaintext },
      ];

      for (const testCase of testCases) {
        const masterKey = await generateMasterKey();
        const fileKey = await deriveFileKey(masterKey, `${testCase.name}.bin`);

        const encrypted = await encryptFile(testCase.data, fileKey);

        const decrypted = await decryptFile(
          encrypted.ciphertext,
          fileKey,
          encrypted.iv,
          encrypted.authTag
        );

        expect(decrypted).toEqual(testCase.data);
      }
    });
  });
});
