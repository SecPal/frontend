// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { formatLocalYmd, isValidIsoCalendarDate } from "./localDate";

describe("formatLocalYmd", () => {
  // Building a Date with `new Date(year, monthIndex, day)` always pins the
  // instant to local-midnight, so checking the formatter against those exact
  // numbers is timezone-stable: regardless of where the test runs, the
  // function must return them verbatim. This is the whole point of using a
  // local-date formatter — a UTC-based formatter (e.g. toISOString().slice)
  // would shift the date in any non-UTC timezone.
  it("returns the local Y-M-D for a freshly built local Date", () => {
    expect(formatLocalYmd(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(formatLocalYmd(new Date(2026, 4, 9))).toBe("2026-05-09");
    expect(formatLocalYmd(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatLocalYmd(new Date(2026, 1, 3))).toBe("2026-02-03");
  });
});

describe("isValidIsoCalendarDate", () => {
  it("accepts well-formed real calendar dates", () => {
    expect(isValidIsoCalendarDate("1990-04-15")).toBe(true);
    expect(isValidIsoCalendarDate("2000-02-29")).toBe(true); // leap year
    expect(isValidIsoCalendarDate("2026-12-31")).toBe(true);
  });

  it("rejects impossible calendar days that the shape regex would accept", () => {
    // The shape `\d{4}-\d{2}-\d{2}` happily matches these, but they don't
    // exist as real days. Catching them client-side is critical under the
    // single-shot onboarding policy, where the backend would otherwise burn
    // the magic link over a simple typo.
    expect(isValidIsoCalendarDate("1990-02-31")).toBe(false);
    expect(isValidIsoCalendarDate("2023-02-29")).toBe(false); // non-leap year
    expect(isValidIsoCalendarDate("2026-04-31")).toBe(false);
    expect(isValidIsoCalendarDate("2026-13-01")).toBe(false);
    expect(isValidIsoCalendarDate("2026-00-15")).toBe(false);
    expect(isValidIsoCalendarDate("2026-06-00")).toBe(false);
  });

  it("rejects values that are not in YYYY-MM-DD shape", () => {
    expect(isValidIsoCalendarDate("")).toBe(false);
    expect(isValidIsoCalendarDate("13/05/1990")).toBe(false);
    expect(isValidIsoCalendarDate("1990-4-15")).toBe(false);
    expect(isValidIsoCalendarDate("1990-04-15T00:00:00Z")).toBe(false);
    expect(isValidIsoCalendarDate("not-a-date")).toBe(false);
  });
});
