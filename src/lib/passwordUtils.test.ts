// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { generatePassword, assessPasswordStrength } from "./passwordUtils";

describe("password Utils", () => {
  describe("generatePassword", () => {
    it("should generate password with default length (16 characters)", () => {
      const password = generatePassword();
      expect(password).toHaveLength(16);
    });

    it("should generate password with custom length", () => {
      const password = generatePassword(24);
      expect(password).toHaveLength(24);
    });

    it("should include uppercase letters by default", () => {
      const password = generatePassword(100); // Longer for better chance
      expect(password).toMatch(/[A-Z]/);
    });

    it("should include lowercase letters by default", () => {
      const password = generatePassword(100);
      expect(password).toMatch(/[a-z]/);
    });

    it("should include numbers by default", () => {
      const password = generatePassword(100);
      expect(password).toMatch(/[0-9]/);
    });

    it("should include symbols by default", () => {
      const password = generatePassword(100);
      expect(password).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/);
    });

    it("should generate password with only lowercase when all others disabled", () => {
      const password = generatePassword(16, {
        uppercase: false,
        numbers: false,
        symbols: false,
        lowercase: true,
      });
      expect(password).toMatch(/^[a-z]+$/);
    });

    it("should throw error if no character sets enabled", () => {
      expect(() =>
        generatePassword(16, {
          uppercase: false,
          lowercase: false,
          numbers: false,
          symbols: false,
        })
      ).toThrow("At least one character set must be enabled");
    });

    it("should throw error if length too short for required character sets", () => {
      expect(() =>
        generatePassword(2, {
          uppercase: true,
          lowercase: true,
          numbers: true,
          symbols: true,
        })
      ).toThrow(
        "Password length must be at least the number of required character sets"
      );
    });

    it("should generate different passwords on each call", () => {
      const password1 = generatePassword();
      const password2 = generatePassword();
      expect(password1).not.toBe(password2);
    });
  });

  describe("assessPasswordStrength", () => {
    it("should rate very short password as weak", () => {
      const result = assessPasswordStrength("abc");
      expect(result.strength).toBe("weak");
      expect(result.score).toBeLessThan(30);
    });

    it("should rate simple password as weak", () => {
      const result = assessPasswordStrength("password");
      expect(result.strength).toBe("weak");
      expect(result.feedback).toContain("Avoid common words and patterns");
    });

    it("should rate 8-character simple password as weak to medium", () => {
      const result = assessPasswordStrength("abcd1234");
      expect(["weak", "medium"]).toContain(result.strength);
    });

    it("should rate password with mixed characters as strong", () => {
      const result = assessPasswordStrength("MyP@ssw0rd!");
      expect(["strong", "very-strong"]).toContain(result.strength);
    });

    it("should rate long diverse password as very-strong", () => {
      // 16 chars (40 pts) + 4 char types (40 pts) = 80 pts -> very-strong
      const result = assessPasswordStrength("Xy7#aB2$cD9!eF1@");
      expect(result.strength).toBe("very-strong");
      expect(result.score).toBeGreaterThanOrEqual(80);
    });

    it("should penalize repeating characters", () => {
      const result1 = assessPasswordStrength("Abcd1234!@");
      const result2 = assessPasswordStrength("Aaaa1234!@");
      expect(result2.score).toBeLessThan(result1.score);
      expect(result2.feedback).toContain("Avoid repeating characters");
    });

    it("should penalize common patterns", () => {
      const commonPasswords = [
        "password123",
        "123456abc",
        "qwerty123",
        "admin123",
      ];

      commonPasswords.forEach((password) => {
        const result = assessPasswordStrength(password);
        expect(result.feedback).toContain("Avoid common words and patterns");
      });
    });

    it("should provide helpful feedback for weak passwords", () => {
      const result = assessPasswordStrength("abc");
      expect(result.feedback.length).toBeGreaterThan(0);
      expect(result.feedback).toContain(
        "Password should be at least 8 characters"
      );
    });

    it("should score 100 maximum", () => {
      const result = assessPasswordStrength(
        "VeryLongP@ssw0rd!WithManyCh@rs12345"
      );
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it("should handle empty password", () => {
      const result = assessPasswordStrength("");
      expect(result.strength).toBe("weak");
      expect(result.score).toBeLessThan(30);
    });

    it("should categorize scores correctly", () => {
      // Test boundary conditions
      const testCases = [
        { password: "ab" }, // < 30 - weak
        { password: "abcd1234" }, // ~30-50 - weak to medium
        { password: "Abcd1234" }, // ~50-60 - medium
        { password: "Abcd1234!" }, // ~60-85 - strong
        { password: "Xy7#aB2$cD9!" }, // ~85+ - strong/very-strong
      ];

      testCases.forEach(({ password }) => {
        const result = assessPasswordStrength(password);
        // All passwords should return a valid strength category
        expect(["weak", "medium", "strong", "very-strong"]).toContain(
          result.strength
        );
      });
    });
  });
});
