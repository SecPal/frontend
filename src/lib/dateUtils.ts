// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const DEFAULT_DATE_FORMAT_OPTIONS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
} satisfies Intl.DateTimeFormatOptions;

const DEFAULT_DATE_TIME_FORMAT_OPTIONS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
} satisfies Intl.DateTimeFormatOptions;

interface ApiDateTimeFormatConfig {
  locale?: string;
  formatOptions?: Intl.DateTimeFormatOptions;
  fallback?: string;
}

function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatDateValue(
  value: string | null | undefined,
  locale: string | undefined,
  formatOptions: Intl.DateTimeFormatOptions,
  fallback = "—"
): string {
  const parsed = parseDateValue(value);

  if (!parsed) {
    return fallback;
  }

  return parsed.toLocaleString(locale, formatOptions);
}

export function formatApiDateTime(
  value: string | null | undefined,
  config: ApiDateTimeFormatConfig = {}
): string {
  return formatDateValue(
    value,
    config.locale,
    config.formatOptions ?? DEFAULT_DATE_TIME_FORMAT_OPTIONS,
    config.fallback
  );
}

/**
 * Format a date string using the current locale.
 * Accepts either an ISO calendar date (`YYYY-MM-DD`) or a canonical
 * SecPal API timestamp when only the calendar portion should be displayed.
 * @param isoDate - ISO date string (e.g., "2025-01-15")
 * @param locale - Locale string (e.g., 'en', 'de')
 * @returns Formatted date string (e.g., "15.01.2025" for de, "1/15/2025" for en)
 */
export function formatDate(isoDate: string, locale: string): string {
  const parsed = parseDateValue(isoDate);

  if (!parsed) {
    return "—";
  }

  return parsed.toLocaleDateString(locale, DEFAULT_DATE_FORMAT_OPTIONS);
}

export function formatDateTime(
  isoDateTime: string | null | undefined,
  locale: string
): string {
  return formatApiDateTime(isoDateTime, {
    locale,
    formatOptions: DEFAULT_DATE_TIME_FORMAT_OPTIONS,
  });
}
