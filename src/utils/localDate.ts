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

/**
 * Return `true` iff `value` is a real calendar date in strict `YYYY-MM-DD`
 * shape — both the format and the actual day on the Gregorian calendar must
 * be valid. A bare regex check would let typos like `1990-02-31` through;
 * for flows that punish a server-side rejection (e.g. the onboarding
 * single-shot policy that burns the magic link on identity-proof failures),
 * client-side calendar validation prevents avoidable hard failures.
 */
export function isValidIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Round-trip through UTC to avoid local-DST shifting a valid day off-by-one;
  // here we only care about the calendar identity of the date, not its instant.
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}
