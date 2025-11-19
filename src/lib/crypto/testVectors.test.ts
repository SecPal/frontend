// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { toHex, fromHex } from "./testVectors";

describe("Test Vector Helpers", () => {
  describe("toHex", () => {
    it("should convert Uint8Array to hex string", () => {
      const input = new Uint8Array([0x00, 0x01, 0x02, 0xff]);
      const result = toHex(input);

      expect(result).toBe("000102ff");
    });

    it("should handle empty array", () => {
      const input = new Uint8Array(0);
      const result = toHex(input);

      expect(result).toBe("");
    });

    it("should pad single digits with zero", () => {
      const input = new Uint8Array([0x0a, 0x0b]);
      const result = toHex(input);

      expect(result).toBe("0a0b");
    });
  });

  describe("fromHex", () => {
    it("should convert hex string to Uint8Array", () => {
      const input = "000102ff";
      const result = fromHex(input);

      expect(result).toEqual(new Uint8Array([0x00, 0x01, 0x02, 0xff]));
    });

    it("should handle empty string", () => {
      const input = "";
      const result = fromHex(input);

      expect(result).toEqual(new Uint8Array(0));
    });

    it("should handle uppercase hex", () => {
      const input = "ABCDEF";
      const result = fromHex(input);

      expect(result).toEqual(new Uint8Array([0xab, 0xcd, 0xef]));
    });

    it("should reject odd length hex strings", () => {
      const input = "abc"; // Odd length

      expect(() => fromHex(input)).toThrow("Invalid hex string (odd length)");
    });
  });

  describe("Round-trip conversion", () => {
    it("should maintain data through toHex/fromHex cycle", () => {
      const original = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc]);

      const hex = toHex(original);
      const restored = fromHex(hex);

      expect(restored).toEqual(original);
    });
  });
});
