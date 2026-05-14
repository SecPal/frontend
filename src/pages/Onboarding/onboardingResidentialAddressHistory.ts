// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import type { useLingui } from "@lingui/react";

export interface ResidentialAddressEntryValue {
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  supplement: string;
  country: string;
  resided_from: string;
  resided_until: string;
}

export interface ResidentialAddressHistoryValue {
  current_address: ResidentialAddressEntryValue;
  previous_addresses: ResidentialAddressEntryValue[];
  /** "" until the user answers the Bewacher ID question. */
  has_current_bewacher_id: "" | "yes" | "no";
  bewacher_id: string;
  bewacher_id_unknown: boolean;
}

export const residentialHistoryBewacherDefaults: Pick<
  ResidentialAddressHistoryValue,
  "has_current_bewacher_id" | "bewacher_id" | "bewacher_id_unknown"
> = {
  has_current_bewacher_id: "",
  bewacher_id: "",
  bewacher_id_unknown: false,
};

export type ResidentialAddressHistoryErrors = Record<string, string>;

export const emptyResidentialAddressEntry: ResidentialAddressEntryValue = {
  street: "",
  house_number: "",
  postal_code: "",
  city: "",
  supplement: "",
  country: "DE",
  resided_from: "",
  resided_until: "",
};

function normalizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeAddressEntry(value: unknown): ResidentialAddressEntryValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...emptyResidentialAddressEntry };
  }

  const entry = value as Record<string, unknown>;

  return {
    street: normalizeString(entry.street),
    house_number: normalizeString(entry.house_number),
    postal_code: normalizeString(entry.postal_code),
    city: normalizeString(entry.city),
    supplement: normalizeString(entry.supplement),
    country: normalizeString(entry.country, "DE"),
    resided_from: normalizeString(entry.resided_from),
    resided_until: normalizeString(entry.resided_until),
  };
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === 1) {
    return true;
  }
  return false;
}

function normalizeYesNo(value: unknown): "" | "yes" | "no" {
  if (value === true) {
    return "yes";
  }
  if (value === false) {
    return "no";
  }
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (s === "yes" || s === "true" || s === "ja") {
    return "yes";
  }
  if (s === "no" || s === "false" || s === "nein") {
    return "no";
  }
  return "";
}

export function getResidentialAddressHistoryValue(
  formData: Record<string, unknown>
): ResidentialAddressHistoryValue {
  const previousRaw = formData.previous_addresses;

  return {
    current_address: normalizeAddressEntry(formData.current_address),
    previous_addresses: Array.isArray(previousRaw)
      ? previousRaw.map((entry) => normalizeAddressEntry(entry))
      : [],
    has_current_bewacher_id: normalizeYesNo(formData.has_current_bewacher_id),
    bewacher_id: normalizeString(formData.bewacher_id),
    bewacher_id_unknown: normalizeBoolean(formData.bewacher_id_unknown),
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function trimAddressValue(value: string): string {
  return value.trim();
}

function formatLocalIsoCalendarDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addCalendarDaysToIsoDate(
  isoDate: string,
  dayDelta: number
): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + dayDelta);
  return formatLocalIsoCalendarDay(dt);
}

function fiveYearHistoryBoundaryIso(referenceDate: Date = new Date()): string {
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const boundary = new Date(
    ref.getFullYear() - 5,
    ref.getMonth(),
    ref.getDate()
  );
  return formatLocalIsoCalendarDay(boundary);
}

/**
 * Whether the current residence alone covers a five-year lookback window from
 * {@link referenceDate} (inclusive), using the local calendar day for both
 * {@link residedFrom} and the boundary date.
 *
 * @returns `true` / `false` when {@link residedFrom} is a valid ISO date, else `null`.
 */
export function currentAddressCoversFiveYearWindow(
  residedFrom: string,
  referenceDate: Date = new Date()
): boolean | null {
  const trimmed = trimAddressValue(residedFrom);
  if (!isIsoDate(trimmed)) {
    return null;
  }

  const boundaryIso = fiveYearHistoryBoundaryIso(referenceDate);
  return trimmed <= boundaryIso;
}

function isPreviousEntryMaterial(entry: ResidentialAddressEntryValue): boolean {
  if (trimAddressValue(entry.street).length > 0) {
    return true;
  }
  if (trimAddressValue(entry.house_number).length > 0) {
    return true;
  }
  if (trimAddressValue(entry.postal_code).length > 0) {
    return true;
  }
  if (trimAddressValue(entry.city).length > 0) {
    return true;
  }
  if (trimAddressValue(entry.supplement).length > 0) {
    return true;
  }
  if (trimAddressValue(entry.resided_from).length > 0) {
    return true;
  }
  const country = trimAddressValue(entry.country);
  if (country.length > 0 && country !== "DE") {
    return true;
  }
  return false;
}

function validateEntry(
  entry: ResidentialAddressEntryValue,
  keyPrefix: string,
  errors: ResidentialAddressHistoryErrors,
  labelPrefix: string,
  translate: ReturnType<typeof useLingui>["_"],
  requireUntilDate: boolean
): void {
  for (const [fieldKey, fieldLabel] of [
    ["street", translate(msg`Street`)],
    ["house_number", translate(msg`House Number`)],
    ["postal_code", translate(msg`Postal Code`)],
    ["city", translate(msg`City`)],
    ["country", translate(msg`Country`)],
  ] as const) {
    if (trimAddressValue(entry[fieldKey]).length > 0) {
      continue;
    }

    errors[`${keyPrefix}.${fieldKey}`] =
      `${labelPrefix}: ${fieldLabel}: ${translate(msg`This field is required.`)}`;
  }

  if (
    trimAddressValue(entry.country).length > 0 &&
    !/^[A-Z]{2}$/.test(entry.country)
  ) {
    errors[`${keyPrefix}.country`] = `${labelPrefix}: ${translate(
      msg`Use a two-letter country code in uppercase, for example DE.`
    )}`;
  }

  if (trimAddressValue(entry.resided_from).length === 0) {
    errors[`${keyPrefix}.resided_from`] = `${labelPrefix}: ${
      requireUntilDate
        ? translate(msg`Resided From`)
        : translate(msg`Living There Since`)
    }: ${translate(msg`This field is required.`)}`;
  } else if (!isIsoDate(entry.resided_from)) {
    errors[`${keyPrefix}.resided_from`] = `${labelPrefix}: ${translate(
      msg`Please use the required format (YYYY-MM-DD).`
    )}`;
  }

  if (requireUntilDate) {
    if (trimAddressValue(entry.resided_until).length === 0) {
      errors[`${keyPrefix}.resided_until`] = `${labelPrefix}: ${translate(
        msg`Resided Until`
      )}: ${translate(msg`This field is required.`)}`;
    } else if (!isIsoDate(entry.resided_until)) {
      errors[`${keyPrefix}.resided_until`] = `${labelPrefix}: ${translate(
        msg`Please use the required format (YYYY-MM-DD).`
      )}`;
    }
  }

  if (
    isIsoDate(entry.resided_from) &&
    isIsoDate(entry.resided_until) &&
    entry.resided_from > entry.resided_until
  ) {
    errors[`${keyPrefix}.resided_until`] = `${labelPrefix}: ${translate(
      msg`The end date must be on or after the start date.`
    )}`;
  }
}

/**
 * Oldest previous residence has a start date on or before the five-year lookback boundary.
 */
function previousResidencesCoverFiveYearWindow(
  value: ResidentialAddressHistoryValue,
  referenceDate: Date = new Date()
): boolean {
  if (
    currentAddressCoversFiveYearWindow(
      value.current_address.resided_from,
      referenceDate
    ) === true
  ) {
    return true;
  }
  const prev = value.previous_addresses;
  if (prev.length === 0) {
    return false;
  }
  const oldest = prev[prev.length - 1]!;
  const from = trimAddressValue(oldest.resided_from);
  if (!isIsoDate(from)) {
    return false;
  }
  return from <= fiveYearHistoryBoundaryIso(referenceDate);
}

/**
 * Whether the five-year address history (previous residences) should be
 * collected: when the user answers **No**, or when they answer **Yes** and
 * then indicates they **do not know** their Bewacher ID. Not shown for **Yes**
 * alone without unknown or ID; not shown when a **Bewacher ID** has been
 * entered.
 */
export function shouldShowPreviousResidencesForBewacher(
  value: ResidentialAddressHistoryValue
): boolean {
  const possession = trimAddressValue(value.has_current_bewacher_id);
  if (possession === "no") {
    return true;
  }
  if (possession !== "yes") {
    return false;
  }
  if (trimAddressValue(value.bewacher_id).length > 0) {
    return false;
  }
  return value.bewacher_id_unknown;
}

function residentialAddressHistoryEqual(
  a: ResidentialAddressHistoryValue,
  b: ResidentialAddressHistoryValue
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Keeps the previous-residence list in sync with the current move-in date and
 * extends the chain until the oldest {@link ResidentialAddressEntryValue.resided_from}
 * reaches the five-year boundary. Returns `null` when nothing changes.
 */
export function syncPreviousResidenceRows(
  value: ResidentialAddressHistoryValue,
  referenceDate: Date = new Date()
): ResidentialAddressHistoryValue | null {
  const coverage = currentAddressCoversFiveYearWindow(
    value.current_address.resided_from,
    referenceDate
  );

  if (coverage === true) {
    if (value.previous_addresses.length === 0) {
      return null;
    }
    if (!value.previous_addresses.some(isPreviousEntryMaterial)) {
      return { ...value, previous_addresses: [] };
    }
    return null;
  }

  if (coverage !== false) {
    return null;
  }

  const curFrom = trimAddressValue(value.current_address.resided_from);
  if (!isIsoDate(curFrom)) {
    return null;
  }

  const boundary = fiveYearHistoryBoundaryIso(referenceDate);
  const untilAfterCurrent = addCalendarDaysToIsoDate(curFrom, -1);
  const rows = value.previous_addresses.map((row) => ({ ...row }));
  let changed = false;

  if (rows.length === 0) {
    rows.push({
      ...emptyResidentialAddressEntry,
      resided_until: untilAfterCurrent,
    });
    changed = true;
  } else if (rows[0]!.resided_until !== untilAfterCurrent) {
    rows[0] = { ...rows[0]!, resided_until: untilAfterCurrent };
    changed = true;
  }

  for (let i = 0; i < rows.length; i++) {
    const from = trimAddressValue(rows[i]!.resided_from);
    if (!isIsoDate(from)) {
      break;
    }
    if (from <= boundary) {
      const tail = rows.slice(i + 1);
      if (
        tail.length > 0 &&
        tail.every((row) => !isPreviousEntryMaterial(row))
      ) {
        rows.splice(i + 1);
        changed = true;
      }
      break;
    }
    const nextUntil = addCalendarDaysToIsoDate(from, -1);
    if (i + 1 >= rows.length) {
      rows.push({
        ...emptyResidentialAddressEntry,
        resided_until: nextUntil,
      });
      changed = true;
      break;
    }
    if (rows[i + 1]!.resided_until !== nextUntil) {
      rows[i + 1] = { ...rows[i + 1]!, resided_until: nextUntil };
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  const next: ResidentialAddressHistoryValue = {
    ...value,
    previous_addresses: rows,
  };
  if (residentialAddressHistoryEqual(next, value)) {
    return null;
  }
  return next;
}

export function validateResidentialAddressHistoryValue(
  value: ResidentialAddressHistoryValue,
  translate: ReturnType<typeof useLingui>["_"]
): ResidentialAddressHistoryErrors {
  const errors: ResidentialAddressHistoryErrors = {};

  validateEntry(
    value.current_address,
    "current_address",
    errors,
    translate(msg`Current Residential Address`),
    translate,
    false
  );

  const coverage = currentAddressCoversFiveYearWindow(
    value.current_address.resided_from
  );

  const possession = trimAddressValue(value.has_current_bewacher_id);
  if (possession !== "yes" && possession !== "no") {
    errors["has_current_bewacher_id"] = translate(
      msg`Please select whether you currently have a Bewacher ID.`
    );
  }

  if (possession === "yes") {
    if (
      !value.bewacher_id_unknown &&
      trimAddressValue(value.bewacher_id).length === 0
    ) {
      errors["bewacher_id"] = translate(
        msg`Enter your Bewacher ID or indicate that you do not know it.`
      );
    }
  }

  const showPreviousResidences = shouldShowPreviousResidencesForBewacher(value);

  if (!showPreviousResidences) {
    return errors;
  }

  if (coverage === true) {
    return errors;
  }

  if (!previousResidencesCoverFiveYearWindow(value)) {
    errors["previous_addresses.coverage"] = translate(
      msg`Complete each earlier residence until your history reaches five years before today, or move your current residence start date back.`
    );
  }

  value.previous_addresses.forEach((entry, index) => {
    if (!isPreviousEntryMaterial(entry)) {
      return;
    }

    validateEntry(
      entry,
      `previous_addresses.${index}`,
      errors,
      translate(msg`Previous residence ${index + 1}`),
      translate,
      true
    );
  });

  return errors;
}
