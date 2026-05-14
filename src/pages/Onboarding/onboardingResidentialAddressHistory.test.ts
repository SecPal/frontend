// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { i18n } from "@lingui/core";
import { describe, expect, it, beforeEach } from "vitest";
import {
  addCalendarDaysToIsoDate,
  currentAddressCoversFiveYearWindow,
  emptyResidentialAddressEntry,
  getResidentialAddressHistoryValue,
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
    expect(
      currentAddressCoversFiveYearWindow("2021-5-1", reference)
    ).toBeNull();
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

  it("does NOT pass the coverage gate when resided_from is blank (null coverage)", () => {
    // coverage === null (unparseable date) is not === true, so the user is
    // NOT considered covered. Both a date-format error and a coverage error
    // must appear — the user must fix the date AND/OR supply previous addresses.
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: fullCurrent(""),
        previous_addresses: [],
      },
      translate
    );

    expect(errors["current_address.resided_from"]).toBeDefined();
    expect(errors["previous_addresses.coverage"]).toBeDefined();
  });

  it("does NOT pass the coverage gate when resided_from is an invalid date string (null coverage)", () => {
    // Same invariant: an unparseable date must not silently satisfy the
    // five-year coverage requirement.
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "no",
        current_address: fullCurrent("not-a-date"),
        previous_addresses: [],
      },
      translate
    );

    expect(errors["current_address.resided_from"]).toBeDefined();
    expect(errors["previous_addresses.coverage"]).toBeDefined();
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

  it("returns null when no change is needed (stable state)", () => {
    const value: ResidentialAddressHistoryValue = {
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
          resided_from: "2019-01-01",
          resided_until: "2024-01-09",
        },
      ],
    };
    expect(syncPreviousResidenceRows(value, ref)).toBeNull();
  });

  it("clears the previous addresses list when current address covers five years", () => {
    const value: ResidentialAddressHistoryValue = {
      ...residentialHistoryBewacherDefaults,
      has_current_bewacher_id: "no",
      current_address: {
        ...emptyResidentialAddressEntry,
        street: "A",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
        resided_from: "2018-01-01",
      },
      previous_addresses: [
        { ...emptyResidentialAddressEntry, resided_until: "2017-12-31" },
      ],
    };
    // All previous rows are empty/non-material — should clear them
    const synced = syncPreviousResidenceRows(value, ref);
    expect(synced).not.toBeNull();
    expect(synced!.previous_addresses).toHaveLength(0);
  });

  it("returns null when current address covers five years and no previous rows exist", () => {
    const value: ResidentialAddressHistoryValue = {
      ...residentialHistoryBewacherDefaults,
      has_current_bewacher_id: "no",
      current_address: {
        ...emptyResidentialAddressEntry,
        street: "A",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
        resided_from: "2018-01-01",
      },
      previous_addresses: [],
    };
    expect(syncPreviousResidenceRows(value, ref)).toBeNull();
  });

  it("returns null when resided_from is not a valid ISO date", () => {
    const value: ResidentialAddressHistoryValue = {
      ...residentialHistoryBewacherDefaults,
      has_current_bewacher_id: "no",
      current_address: { ...emptyResidentialAddressEntry },
      previous_addresses: [],
    };
    expect(syncPreviousResidenceRows(value, ref)).toBeNull();
  });

  it("updates resided_until of the first row when current move-in changes", () => {
    const value: ResidentialAddressHistoryValue = {
      ...residentialHistoryBewacherDefaults,
      has_current_bewacher_id: "no",
      current_address: {
        ...emptyResidentialAddressEntry,
        street: "A",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
        resided_from: "2024-06-01",
      },
      previous_addresses: [
        {
          ...emptyResidentialAddressEntry,
          resided_until: "2023-12-31",
        },
      ],
    };
    const synced = syncPreviousResidenceRows(value, ref);
    expect(synced).not.toBeNull();
    expect(synced!.previous_addresses[0]!.resided_until).toBe("2024-05-31");
  });
});

describe("getResidentialAddressHistoryValue normalization", () => {
  it("normalizes boolean true/false for has_current_bewacher_id", () => {
    expect(
      getResidentialAddressHistoryValue({ has_current_bewacher_id: true })
        .has_current_bewacher_id
    ).toBe("yes");
    expect(
      getResidentialAddressHistoryValue({ has_current_bewacher_id: false })
        .has_current_bewacher_id
    ).toBe("no");
  });

  it("normalizes string yes/no/ja/nein for has_current_bewacher_id", () => {
    expect(
      getResidentialAddressHistoryValue({ has_current_bewacher_id: "ja" })
        .has_current_bewacher_id
    ).toBe("yes");
    expect(
      getResidentialAddressHistoryValue({ has_current_bewacher_id: "nein" })
        .has_current_bewacher_id
    ).toBe("no");
  });

  it("normalizes boolean strings for bewacher_id_unknown", () => {
    expect(
      getResidentialAddressHistoryValue({ bewacher_id_unknown: "true" })
        .bewacher_id_unknown
    ).toBe(true);
    expect(
      getResidentialAddressHistoryValue({ bewacher_id_unknown: 1 })
        .bewacher_id_unknown
    ).toBe(true);
  });

  it("normalizes a previous_addresses array with object entries", () => {
    const value = getResidentialAddressHistoryValue({
      previous_addresses: [
        { street: "Musterstr.", house_number: "5", country: "DE" },
        null,
        "invalid",
      ],
    });
    expect(value.previous_addresses).toHaveLength(3);
    expect(value.previous_addresses[0]!.street).toBe("Musterstr.");
    expect(value.previous_addresses[1]!.street).toBe("");
    expect(value.previous_addresses[2]!.street).toBe("");
  });
});

describe("validateResidentialAddressHistoryValue — date format errors", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  const translate = i18n._.bind(i18n) as typeof i18n._;

  it("reports invalid resided_from format for current address", () => {
    const errors = validateResidentialAddressHistoryValue(
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
          resided_from: "not-a-date",
        },
        previous_addresses: [],
      },
      translate
    );

    expect(errors["current_address.resided_from"]).toMatch(/required format/i);
  });

  it("validates a material previous entry requiring both dates", () => {
    const errors = validateResidentialAddressHistoryValue(
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
          resided_from: localIsoDateWithDayOffset(-100),
        },
        previous_addresses: [
          {
            street: "Old",
            house_number: "2",
            postal_code: "20095",
            city: "Hamburg",
            supplement: "",
            country: "DE",
            resided_from: "",
            resided_until: "",
          },
        ],
      },
      translate
    );

    expect(errors["previous_addresses.0.resided_from"]).toMatch(
      /resided from.*required/i
    );
    expect(errors["previous_addresses.0.resided_until"]).toMatch(
      /resided until.*required/i
    );
  });

  it("does not require previous residences when yes + known Bewacher ID", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "yes",
        bewacher_id: "BW-999",
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
    expect(errors["bewacher_id"]).toBeUndefined();
  });

  it("accepts bewacher_id_unknown=true as a valid answer when yes is selected", () => {
    const errors = validateResidentialAddressHistoryValue(
      {
        ...residentialHistoryBewacherDefaults,
        has_current_bewacher_id: "yes",
        bewacher_id: "",
        bewacher_id_unknown: true,
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

    expect(errors["bewacher_id"]).toBeUndefined();
  });
});
