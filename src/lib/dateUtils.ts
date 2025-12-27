// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Format a date string using the current locale
 * @param isoDate - ISO date string (e.g., "2025-01-15")
 * @param locale - Locale string (e.g., 'en', 'de')
 * @returns Formatted date string (e.g., "15.01.2025" for de, "1/15/2025" for en)
 */
export function formatDate(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
