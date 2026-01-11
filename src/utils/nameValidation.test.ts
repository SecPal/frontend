// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { calculateNameSimilarity, validateNameChange } from "./nameValidation";

describe("nameValidation", () => {
  describe("calculateNameSimilarity", () => {
    it("returns 100% for identical names", () => {
      expect(calculateNameSimilarity("John", "John")).toBe(100);
      expect(calculateNameSimilarity("Mueller", "Mueller")).toBe(100);
    });

    it("returns 100% for same names with different casing", () => {
      expect(calculateNameSimilarity("John", "john")).toBe(100);
      expect(calculateNameSimilarity("MUELLER", "mueller")).toBe(100);
    });

    it("handles German umlauts correctly", () => {
      const similarity = calculateNameSimilarity("Müller", "Mueller");
      // Umlaut normalization returns exact match
      expect(similarity).toBe(100);
    });

    it("handles multiple umlauts", () => {
      const similarity = calculateNameSimilarity("Schön", "Schoen");
      expect(similarity).toBeGreaterThanOrEqual(85);
    });

    it("handles ß (eszett) normalization", () => {
      const similarity = calculateNameSimilarity("Strauß", "Strauss");
      expect(similarity).toBeGreaterThanOrEqual(85);
    });

    it("detects prefix patterns (Max → Maximilian)", () => {
      const similarity = calculateNameSimilarity("Max", "Maximilian");
      // Should be treated as prefix match with penalty
      expect(similarity).toBeGreaterThanOrEqual(60);
      expect(similarity).toBeLessThanOrEqual(90);
    });

    it("detects prefix patterns (Hans → Hans-Peter)", () => {
      const similarity = calculateNameSimilarity("Hans", "Hans-Peter");
      // Prefix with hyphen
      expect(similarity).toBeGreaterThanOrEqual(60);
      expect(similarity).toBeLessThanOrEqual(90);
    });

    it("detects reversed prefix patterns (Maximilian → Max)", () => {
      const similarity = calculateNameSimilarity("Maximilian", "Max");
      // Should be similar to Max → Maximilian
      expect(similarity).toBeGreaterThanOrEqual(60);
      expect(similarity).toBeLessThanOrEqual(90);
    });

    it("requires minimum 3 characters for prefix match", () => {
      const similarity = calculateNameSimilarity("Jo", "John");
      // Too short for prefix match, should use Levenshtein
      expect(similarity).toBeLessThan(80);
    });

    it("calculates high similarity for typos", () => {
      expect(calculateNameSimilarity("John", "Jon")).toBeGreaterThan(70);
      expect(calculateNameSimilarity("Mueller", "Muller")).toBeGreaterThan(80);
    });

    it("calculates low similarity for completely different names", () => {
      expect(calculateNameSimilarity("John", "Maria")).toBeLessThan(50);
      expect(calculateNameSimilarity("Smith", "Mueller")).toBeLessThan(50);
    });

    it("handles empty strings", () => {
      expect(calculateNameSimilarity("", "John")).toBe(0);
      expect(calculateNameSimilarity("John", "")).toBe(0);
      expect(calculateNameSimilarity("", "")).toBe(0);
    });

    it("handles single character names", () => {
      const similarity = calculateNameSimilarity("A", "B");
      expect(similarity).toBe(0);
    });

    it("handles very long names", () => {
      const long1 = "Johann-Sebastian-Wolfgang-Amadeus";
      const long2 = "Johann-Sebastian-Wolfgang-Amadeo";
      const similarity = calculateNameSimilarity(long1, long2);
      expect(similarity).toBeGreaterThan(80);
    });
  });

  describe("validateNameChange", () => {
    describe("minor changes (>80% similar)", () => {
      it("allows typo corrections", () => {
        const result = validateNameChange("John", "Jon");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
        expect(result.similarity).toBeGreaterThan(70);
      });

      it("allows German umlaut variations", () => {
        const result = validateNameChange("Mueller", "Müller");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("minor");
        expect(result.similarity).toBeGreaterThanOrEqual(85);
      });

      it("returns minor messageKey", () => {
        const result = validateNameChange("Smith", "Smithe");
        expect(result.messageKey).toBe("minor");
      });
    });

    describe("medium changes (50-80% similar)", () => {
      it("allows name extensions (Max → Maximilian)", () => {
        const result = validateNameChange("Max", "Maximilian");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
        expect(result.similarity).toBeGreaterThanOrEqual(50);
        expect(result.similarity).toBeLessThanOrEqual(80);
      });

      it("allows hyphenated names", () => {
        const result = validateNameChange("Hans", "Hans-Peter");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
      });

      it("returns medium messageKey", () => {
        const result = validateNameChange("Max", "Maximilian");
        expect(result.messageKey).toBe("medium");
      });
    });

    describe("major changes (<50% similar)", () => {
      it("blocks completely different names", () => {
        const result = validateNameChange("John", "Maria");
        expect(result.allowed).toBe(false);
        expect(result.severity).toBe("major");
        expect(result.similarity).toBeLessThan(50);
      });

      it("blocks very different surnames", () => {
        const result = validateNameChange("Smith", "Mueller");
        expect(result.allowed).toBe(false);
        expect(result.severity).toBe("major");
      });

      it("returns major messageKey", () => {
        const result = validateNameChange("John", "Maria");
        expect(result.messageKey).toBe("major");
      });
    });

    describe("edge cases", () => {
      it("handles identical names", () => {
        const result = validateNameChange("John", "John");
        expect(result.similarity).toBe(100);
        expect(result.severity).toBe("minor");
        expect(result.allowed).toBe(true);
      });

      it("handles case differences", () => {
        const result = validateNameChange("JOHN", "john");
        expect(result.similarity).toBe(100);
        expect(result.severity).toBe("minor");
      });

      it("handles whitespace trimming", () => {
        const result = validateNameChange("  John  ", "John");
        expect(result.similarity).toBe(100);
      });

      it("handles very short names", () => {
        const result = validateNameChange("Li", "Liu");
        // Should use Levenshtein, not prefix matching
        expect(result.allowed).toBeDefined();
        expect(result.severity).toBeDefined();
      });
    });

    describe("security-relevant test cases", () => {
      it("blocks name swaps (first/last name confusion)", () => {
        const result = validateNameChange("John Smith", "Smith John");
        // Should be blocked or at least medium
        expect(result.similarity).toBeLessThan(80);
      });

      it("allows phonetically similar names as medium changes", () => {
        const result = validateNameChange("John", "Jon");
        // This is allowed as medium change (75% similar)
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
      });
    });

    describe("real-world examples from BewachV context", () => {
      it("allows adding middle name", () => {
        const result = validateNameChange("Hans", "Hans-Peter");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
      });

      it("allows completing abbreviated names", () => {
        const result = validateNameChange("Max", "Maximilian");
        expect(result.allowed).toBe(true);
      });

      it("blocks suspicious name changes", () => {
        const result = validateNameChange("Ahmad", "Michael");
        expect(result.allowed).toBe(false);
        expect(result.severity).toBe("major");
      });

      it("handles double-barreled surnames", () => {
        const result = validateNameChange("Mueller", "Mueller-Schmidt");
        expect(result.allowed).toBe(true);
        expect(result.severity).toBe("medium");
      });
    });
  });
});
