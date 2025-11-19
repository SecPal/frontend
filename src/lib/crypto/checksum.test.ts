// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { calculateChecksum, verifyChecksum } from "./checksum";
import { CHECKSUM_TEST_VECTORS } from "./testVectors";

describe("SHA-256 Checksums", () => {
  describe("calculateChecksum", () => {
    it("should calculate SHA-256 checksum for empty input", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[0];
      const checksum = await calculateChecksum(testVector.input);

      expect(checksum).toBe(testVector.expectedChecksum);
    });

    it("should calculate SHA-256 checksum for simple text", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[1];
      const checksum = await calculateChecksum(testVector.input);

      expect(checksum).toBe(testVector.expectedChecksum);
    });

    it("should calculate SHA-256 checksum for binary data", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[2];
      const checksum = await calculateChecksum(testVector.input);

      expect(checksum).toBe(testVector.expectedChecksum);
    });

    it("should return lowercase hex string", async () => {
      const data = new TextEncoder().encode("test");
      const checksum = await calculateChecksum(data);

      expect(checksum).toMatch(/^[0-9a-f]{64}$/); // 64 hex chars (256 bits)
      expect(checksum).toBe(checksum.toLowerCase());
    });

    it("should produce consistent results for same input", async () => {
      const data = new TextEncoder().encode("SecPal Test Data");

      const checksum1 = await calculateChecksum(data);
      const checksum2 = await calculateChecksum(data);

      expect(checksum1).toBe(checksum2);
    });

    it("should produce different checksums for different inputs", async () => {
      const data1 = new TextEncoder().encode("file1.pdf");
      const data2 = new TextEncoder().encode("file2.pdf");

      const checksum1 = await calculateChecksum(data1);
      const checksum2 = await calculateChecksum(data2);

      expect(checksum1).not.toBe(checksum2);
    });

    it("should handle large data (1MB)", async () => {
      const largeData = new Uint8Array(1024 * 1024).fill(0x42);

      const checksum = await calculateChecksum(largeData);

      expect(checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(checksum.length).toBe(64); // 256 bits in hex
    });
  });

  describe("verifyChecksum", () => {
    it("should return true for matching checksums (empty input)", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[0];

      const isValid = await verifyChecksum(
        testVector.input,
        testVector.expectedChecksum
      );

      expect(isValid).toBe(true);
    });

    it("should return true for matching checksums (simple text)", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[1];

      const isValid = await verifyChecksum(
        testVector.input,
        testVector.expectedChecksum
      );

      expect(isValid).toBe(true);
    });

    it("should return true for matching checksums (binary data)", async () => {
      const testVector = CHECKSUM_TEST_VECTORS[2];

      const isValid = await verifyChecksum(
        testVector.input,
        testVector.expectedChecksum
      );

      expect(isValid).toBe(true);
    });

    it("should return false for mismatched checksums", async () => {
      const data = new TextEncoder().encode("test data");
      const wrongChecksum = "a".repeat(64); // Invalid checksum

      const isValid = await verifyChecksum(data, wrongChecksum);

      expect(isValid).toBe(false);
    });

    it("should return false if data is tampered", async () => {
      const originalData = new TextEncoder().encode("original data");
      const expectedChecksum = await calculateChecksum(originalData);

      const tamperedData = new TextEncoder().encode("tampered data");
      const isValid = await verifyChecksum(tamperedData, expectedChecksum);

      expect(isValid).toBe(false);
    });

    it("should handle uppercase and lowercase checksums", async () => {
      const data = new TextEncoder().encode("test");
      const checksum = await calculateChecksum(data);

      const uppercaseChecksum = checksum.toUpperCase();

      const isValidLower = await verifyChecksum(data, checksum);
      const isValidUpper = await verifyChecksum(data, uppercaseChecksum);

      expect(isValidLower).toBe(true);
      expect(isValidUpper).toBe(true);
    });

    it("should reject invalid checksum format", async () => {
      const data = new TextEncoder().encode("test");

      // Too short
      const tooShort = "abc123";
      const validShort = await verifyChecksum(data, tooShort);
      expect(validShort).toBe(false);

      // Invalid characters
      const invalidChars = "z".repeat(64);
      const validChars = await verifyChecksum(data, invalidChars);
      expect(validChars).toBe(false);
    });

    it("should verify large data (1MB)", async () => {
      const largeData = new Uint8Array(1024 * 1024).fill(0x42);
      const checksum = await calculateChecksum(largeData);

      const isValid = await verifyChecksum(largeData, checksum);

      expect(isValid).toBe(true);
    });
  });

  describe("Integration tests", () => {
    it("should verify freshly calculated checksums", async () => {
      const testData = [
        new TextEncoder().encode("file1.pdf"),
        new TextEncoder().encode("image.jpg"),
        new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        new Uint8Array(1024).fill(0xff),
      ];

      for (const data of testData) {
        const checksum = await calculateChecksum(data);
        const isValid = await verifyChecksum(data, checksum);

        expect(isValid).toBe(true);
      }
    });

    it("should detect single-bit tampering", async () => {
      const originalData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      const checksum = await calculateChecksum(originalData);

      // Flip one bit
      const tamperedData = new Uint8Array(originalData);
      if (tamperedData.length > 2 && tamperedData[2] !== undefined) {
        tamperedData[2] ^= 0x01; // Flip bit in 3rd byte
      }

      const isValid = await verifyChecksum(tamperedData, checksum);

      expect(isValid).toBe(false);
    });
  });
});
