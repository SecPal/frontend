// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { formatLocalYmd } from "./localDate";

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
