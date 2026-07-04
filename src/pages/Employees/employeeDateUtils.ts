// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

export interface ParsedEmployeeDate {
  iso: string;
  formatted: string;
  valid: boolean;
}

export const GERMAN_CONTRACT_START_DATE_HINT =
  "Erwartetes Format: TT.MM.JJJJ. Optional ist TT.MM.; das aktuelle Jahr wird automatisch ergänzt.";
export const GERMAN_CONTRACT_START_DATE_FORMAT =
  "TT.MM.JJJJ (optional TT.MM. für das aktuelle Jahr)";
export const GERMAN_CONTRACT_START_DATE_ERROR =
  "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ (optional TT.MM. für das aktuelle Jahr).";

interface ParseEmployeeDateToIsoOptions {
  allowIsoInput?: boolean;
  defaultCurrentYearForMissingYear?: boolean;
}

function parseDateParts(
  displayDate: string,
  locale: string,
  allowIsoInput: boolean,
  defaultCurrentYearForMissingYear: boolean
): { day: number; month: number; year: number } | null {
  let day: number;
  let month: number;
  let year: number;
  const normalizedDisplayDate = displayDate.trim();

  if (allowIsoInput && /^\d{4}-\d{2}-\d{2}$/.test(normalizedDisplayDate)) {
    const parts = normalizedDisplayDate.split("-");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return null;
    }
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else if (locale === "de") {
    const shortDateMatch = normalizedDisplayDate.match(
      /^(\d{1,2})\.(\d{1,2})\.?$/
    );
    if (defaultCurrentYearForMissingYear && shortDateMatch) {
      const shortDay = shortDateMatch[1];
      const shortMonth = shortDateMatch[2];
      if (!shortDay || !shortMonth) {
        return null;
      }

      day = parseInt(shortDay, 10);
      month = parseInt(shortMonth, 10);
      year = new Date().getFullYear();
      return { day, month, year };
    }

    const parts = normalizedDisplayDate.split(".");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return null;
    }
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    const parts = normalizedDisplayDate.split("/");
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      return null;
    }
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  }

  if (year >= 0 && year <= 99) {
    year += year >= 50 ? 1900 : 2000;
  }

  return { day, month, year };
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }

  const testDate = new Date(year, month - 1, day);
  return (
    testDate.getDate() === day &&
    testDate.getMonth() === month - 1 &&
    testDate.getFullYear() === year
  );
}

export function parseEmployeeDateToISO(
  displayDate: string,
  locale: string,
  options: ParseEmployeeDateToIsoOptions = {}
): ParsedEmployeeDate {
  if (!displayDate) {
    return { iso: "", formatted: "", valid: false };
  }

  try {
    const parsedDate = parseDateParts(
      displayDate,
      locale,
      options.allowIsoInput === true,
      options.defaultCurrentYearForMissingYear === true
    );
    if (!parsedDate) {
      return { iso: "", formatted: displayDate, valid: false };
    }

    const { day, month, year } = parsedDate;
    if (!isValidDate(day, month, year)) {
      return { iso: "", formatted: displayDate, valid: false };
    }

    const dayStr = day.toString().padStart(2, "0");
    const monthStr = month.toString().padStart(2, "0");
    const yearStr = year.toString();

    return {
      iso: `${yearStr}-${monthStr}-${dayStr}`,
      formatted:
        locale === "de"
          ? `${dayStr}.${monthStr}.${yearStr}`
          : `${monthStr}/${dayStr}/${yearStr}`,
      valid: true,
    };
  } catch {
    return { iso: "", formatted: displayDate, valid: false };
  }
}

export function formatEmployeeDateForDisplay(
  isoDate: string,
  locale: string
): string {
  if (!isoDate) {
    return "";
  }

  const date = new Date(isoDate);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return locale === "de"
    ? `${day}.${month}.${year}`
    : `${month}/${day}/${year}`;
}
