// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import {
  formatApiDateTime,
  formatDate,
  formatDateTime,
  isCanonicalApiTimestamp,
  parseApiTimestamp,
} from "./dateUtils";

describe("formatDate", () => {
  it("formats ISO date string using the given locale", () => {
    const result = formatDate("2026-03-23", "en");
    expect(result).toContain("2026");
    expect(result).toContain("03");
    expect(result).toContain("23");
  });

  it("formats canonical API timestamps when only the date portion is needed", () => {
    const result = formatDate("2026-03-23T09:15:00Z", "en");
    expect(result).toContain("2026");
    expect(result).toContain("03");
    expect(result).toContain("23");
  });
});

describe("isCanonicalApiTimestamp", () => {
  it("accepts whole-second UTC timestamps with a trailing Z", () => {
    expect(isCanonicalApiTimestamp("2026-03-23T09:15:00Z")).toBe(true);
  });

  it("rejects fractional seconds and explicit offsets", () => {
    expect(isCanonicalApiTimestamp("2026-03-23T09:15:00.000Z")).toBe(false);
    expect(isCanonicalApiTimestamp("2026-03-23T10:15:00+01:00")).toBe(false);
  });
});

describe("parseApiTimestamp", () => {
  it("parses canonical API timestamps", () => {
    expect(parseApiTimestamp("2026-03-23T09:15:00Z")?.toISOString()).toBe(
      "2026-03-23T09:15:00.000Z"
    );
  });

  it("returns null for missing or invalid input", () => {
    expect(parseApiTimestamp("")).toBeNull();
    expect(parseApiTimestamp("not-a-date")).toBeNull();
  });
});

describe("formatDateTime", () => {
  it("formats ISO datetime string and includes time components", () => {
    const result = formatDateTime("2026-03-23T09:15:00Z", "en");
    expect(result).toContain("2026");
    // Result should contain at least a colon (time separator)
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("returns a longer string than formatDate for the same timestamp", () => {
    const isoTimestamp = "2026-03-23T09:15:00Z";
    const date = formatDate(isoTimestamp, "en");
    const dateTime = formatDateTime(isoTimestamp, "en");
    expect(dateTime.length).toBeGreaterThan(date.length);
  });
});

describe("formatApiDateTime", () => {
  it("supports shared custom formatting for API timestamps", () => {
    const result = formatApiDateTime("2026-03-23T09:15:00Z", {
      locale: "en",
      formatOptions: {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      },
    });

    expect(result).toContain("2026");
    expect(result).toMatch(/09:15/);
  });

  it("returns the configured fallback for missing or invalid timestamps", () => {
    expect(formatApiDateTime("", { locale: "en" })).toBe("—");
    expect(formatApiDateTime("invalid", { locale: "en", fallback: "-" })).toBe(
      "-"
    );
  });
});
