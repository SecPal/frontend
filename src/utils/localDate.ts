// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Format a `Date` as `YYYY-MM-DD` in the **local** timezone.
 *
 * We deliberately do NOT use `Date.prototype.toISOString().slice(0, 10)` for
 * this: that returns the **UTC** date, which can be a calendar day off from
 * the user's perspective near midnight in any non-UTC timezone (e.g. UTC+12
 * at 11:00 local time is still "yesterday" in UTC). Comparing form input that
 * is interpreted in local time against a UTC "today" leads to subtle bugs
 * such as rejecting a date-of-birth that is actually in the past locally.
 */
export function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
