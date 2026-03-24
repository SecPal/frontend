// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "./dateUtils";

describe("formatDate", () => {
  it("formats ISO date string using the given locale", () => {
    const result = formatDate("2026-03-23", "en");
    expect(result).toContain("2026");
    expect(result).toContain("03");
    expect(result).toContain("23");
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
