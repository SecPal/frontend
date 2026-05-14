// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from "@lingui/core";
import { describe, expect, it, beforeEach } from "vitest";
import {
  addCalendarDaysToIsoDate,
  currentAddressCoversFiveYearWindow,
  emptyResidentialAddressEntry,
  residentialHistoryBewacherDefaults,
  shouldShowPreviousResidencesForBewacher,
  syncPreviousResidenceRows,
  type ResidentialAddressHistoryValue,
  validateResidentialAddressHistoryValue,
} from "./onboardingResidentialAddressHistory";

describe("shouldShowPreviousResidencesForBewacher", () => {
  const base = (): ResidentialAddressHistoryValue => ({
    current_address: { ...emptyResidentialAddressEntry },
    previous_addresses: [],
    ...residentialHistoryBewacherDefaults,
  });

  it("shows after No", () => {
    expect(
      shouldShowPreviousResidencesForBewacher({
        ...base(),
        has_current_bewacher_id: "no",
      })
    ).toBe(true);
  });

  it("hides when Yes with neither ID nor unknown", () => {
    expect(
      shouldShowPreviousResidencesForBewacher({
        ...base(),
        has_current_bewacher_id: "yes",
        bewacher_id: "",
        bewacher_id_unknown: false,
      })
    ).toBe(false);
  });

  it("shows when Yes and ID unknown", () => {
    expect(
      shouldShowPreviousResidencesForBewacher({
        ...base(),
        has_current_bewacher_id: "yes",
        bewacher_id: "",
        bewacher_id_unknown: true,
      })
    ).toBe(true);
  });

  it("hides when Yes and an ID is entered", () => {
    expect(
      shouldShowPreviousResidencesForBewacher({
        ...base(),
        has_current_bewacher_id: "yes",
        bewacher_id: "BW-1",
        bewacher_id_unknown: false,
      })
    ).toBe(false);
  });

  it("hides before the Bewacher question is answered", () => {
    expect(shouldShowPreviousResidencesForBewacher(base())).toBe(false);
  });
});

describe("currentAddressCoversFiveYearWindow", () => {
  const reference = new Date(2026, 4, 11);

  it("returns null when the date is missing or not ISO", () => {
    expect(currentAddressCoversFiveYearWindow("", reference)).toBeNull();
    expect(currentAddressCoversFiveYearWindow("  ", reference)).toBeNull();
    expect(currentAddressCoversFiveYearWindow("2021-5-1", reference)).toBeNull();
  });

  it("returns true when residence started on or before the five-year boundary", () => {
    expect(currentAddressCoversFiveYearWindow("2021-05-10", reference)).toBe(
      true
    );
    expect(currentAddressCoversFiveYearWindow("2021-05-11", reference)).toBe(
      true
    );
  });

  it("returns false when residence started after the five-year boundary", () => {
    expect(currentAddressCoversFiveYearWindow("2021-05-12", reference)).toBe(
      false
    );
  });
});

function localIsoDateWithDayOffset(dayOffset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("validateResidentialAddressHistoryValue five-year coverage", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  const translate = i18n._.bind(i18n) as typeof i18n._;

  const fullCurrent = (residedFrom: string) => ({
    ...emptyResidentialAddressEntry,
    street: "Hauptstr.",
    house_number: "1",
    postal_code: "10115",
    city: "Berlin",
    country: "DE",
    resided_from: residedFrom,
  });

  it("does not require previous residences when the current address covers five years", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: fullCurrent(localIsoDateWithDayOffset(-365 * 6)),
        previous_addresses: [],
      },
      translate
    );

    expect(errors["previous_addresses.coverage"]).toBeUndefined();
  });

  it("requires previous residences when the current address does not cover five years", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: fullCurrent(localIsoDateWithDayOffset(-100)),
        previous_addresses: [],
      },
      translate
    );

    expect(errors["previous_addresses.coverage"]).toMatch(
      /complete each earlier residence/i
    );
  });

  it("ignores empty previous slots when coverage is satisfied", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: fullCurrent(localIsoDateWithDayOffset(-365 * 6)),
        previous_addresses: [{ ...emptyResidentialAddressEntry }],
      },
      translate
    );

    expect(errors["previous_addresses.coverage"]).toBeUndefined();
    expect(errors["previous_addresses.0.street"]).toBeUndefined();
  });
});

describe("validateResidentialAddressHistoryValue Bewacher ID", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  const translate = i18n._.bind(i18n) as typeof i18n._;

  it("requires answering the Bewacher ID question", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        current_address: {
          ...emptyResidentialAddressEntry,
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          country: "DE",
          resided_from: localIsoDateWithDayOffset(-100),
        },
        previous_addresses: [],
      },
      translate
    );

    expect(errors["has_current_bewacher_id"]).toBeDefined();
  });

  it("requires an ID or unknown when the user has a Bewacher ID", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "yes",
        current_address: {
          ...emptyResidentialAddressEntry,
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          country: "DE",
          resided_from: localIsoDateWithDayOffset(-100),
        },
        previous_addresses: [],
      },
      translate
    );

    expect(errors["bewacher_id"]).toBeDefined();
  });

  it("does not require address history coverage when a Bewacher ID is provided", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "yes",
        bewacher_id: "BW-123",
        bewacher_id_unknown: false,
        current_address: {
          ...emptyResidentialAddressEntry,
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          country: "DE",
          resided_from: localIsoDateWithDayOffset(-100),
        },
        previous_addresses: [],
      },
      translate
    );

    expect(errors["previous_addresses.coverage"]).toBeUndefined();
  });
});

describe("syncPreviousResidenceRows", () => {
  const ref = new Date(2026, 4, 11);

  it("seeds the first previous row with until = current move-in minus one day", () => {
    const synced = syncPreviousResidenceRows(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: {
          ...emptyResidentialAddressEntry,
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          country: "DE",
          resided_from: "2024-01-10",
        },
        previous_addresses: [],
      },
      ref
    );

    expect(synced).not.toBeNull();
    expect(synced!.previous_addresses).toHaveLength(1);
    expect(synced!.previous_addresses[0]!.resided_until).toBe(
      addCalendarDaysToIsoDate("2024-01-10", -1)
    );
  });

  it("appends another row when the newest previous start is still after the boundary", () => {
    const synced = syncPreviousResidenceRows(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: {
          ...emptyResidentialAddressEntry,
          street: "A",
          house_number: "1",
          postal_code: "10115",
          city: "Berlin",
          country: "DE",
          resided_from: "2024-01-10",
        },
        previous_addresses: [
          {
            ...emptyResidentialAddressEntry,
            street: "Old",
            house_number: "2",
            postal_code: "20095",
            city: "Hamburg",
            country: "DE",
            resided_from: "2023-06-01",
            resided_until: "2024-01-09",
          },
        ],
      },
      ref
    );

    expect(synced).not.toBeNull();
    expect(synced!.previous_addresses).toHaveLength(2);
    expect(synced!.previous_addresses[1]!.resided_until).toBe(
      addCalendarDaysToIsoDate("2023-06-01", -1)
    );
  });
});
