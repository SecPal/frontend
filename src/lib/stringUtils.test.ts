// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { getInitials } from "./stringUtils";

describe("getInitials", () => {
  it("returns correct initials for two-word name", () => {
    expect(getInitials("John Doe")).toBe("JD");
  });

  it("returns correct initials for single-word name", () => {
    expect(getInitials("Alice")).toBe("A");
  });

  it("returns correct initials for three-word name (takes first two)", () => {
    expect(getInitials("John Jacob Smith")).toBe("JJ");
  });

  it("returns empty string for empty input", () => {
    expect(getInitials("")).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(getInitials("   ")).toBe("");
  });

  it("handles leading and trailing whitespace", () => {
    expect(getInitials("  Jane Doe  ")).toBe("JD");
  });

  it("handles multiple spaces between words", () => {
    expect(getInitials("John   Doe")).toBe("JD");
  });

  it("converts to uppercase", () => {
    expect(getInitials("john doe")).toBe("JD");
  });

  it("handles single character name", () => {
    expect(getInitials("A")).toBe("A");
  });
});
