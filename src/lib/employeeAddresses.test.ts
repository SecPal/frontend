// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { EmployeeAddress } from "@/types/api/employees";
import {
  buildAddressesPayloadForCurrentEdit,
  getCurrentAddressFromList,
} from "./employeeAddresses";

function addr(partial: Partial<EmployeeAddress> & { id: string }): EmployeeAddress {
  return {
    street: null,
    house_number: null,
    postal_code: null,
    city: null,
    supplement: null,
    country: null,
    state: null,
    resided_from: null,
    resided_until: null,
    ...partial,
  };
}

describe("getCurrentAddressFromList", () => {
  it("returns null for undefined, null, or empty list", () => {
    expect(getCurrentAddressFromList(undefined)).toBeNull();
    expect(getCurrentAddressFromList(null)).toBeNull();
    expect(getCurrentAddressFromList([])).toBeNull();
  });

  it("returns the row with null resided_until as current", () => {
    const current = addr({
      id: "a1",
      street: "Haupt",
      resided_until: null,
    });
    const past = addr({
      id: "a0",
      street: "Alt",
      resided_until: "2020-01-01",
    });
    expect(getCurrentAddressFromList([past, current])).toEqual(current);
  });

  it("treats empty string resided_until like current residence", () => {
    const row = addr({ id: "a1", resided_until: "" });
    expect(getCurrentAddressFromList([row])).toEqual(row);
  });

  it("returns the first matching row when multiple candidates exist", () => {
    const first = addr({ id: "x", city: "Erste", resided_until: null });
    const second = addr({ id: "y", city: "Zweite", resided_until: null });
    expect(getCurrentAddressFromList([first, second])).toEqual(first);
  });
});

describe("buildAddressesPayloadForCurrentEdit", () => {
  const draft = {
    street: "  Neue Str  ",
    houseNumber: " 1 ",
    postalCode: "10115",
    city: "Berlin",
    supplement: "",
    country: "de",
    state: "BE",
  };

  it("builds a single open-ended row when there is no prior address list", () => {
    expect(buildAddressesPayloadForCurrentEdit([], draft)).toEqual([
      {
        street: "Neue Str",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        supplement: null,
        country: "DE",
        state: "BE",
        resided_from: null,
        resided_until: null,
      },
    ]);
  });

  it("preserves historical rows and replaces the current row", () => {
    const historical = addr({
      id: "old-1",
      street: "Altstraße",
      city: "Köln",
      resided_until: "2019-06-01",
    });
    const current = addr({
      id: "cur-1",
      street: "Jetztstraße",
      city: "Berlin",
      resided_from: "2019-06-02",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([historical, current], draft);

    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({
      street: "Altstraße",
      city: "Köln",
      resided_until: "2019-06-01",
    });
    expect(payload[1]).toMatchObject({
      street: "Neue Str",
      house_number: "1",
      postal_code: "10115",
      city: "Berlin",
      supplement: null,
      country: "DE",
      state: "BE",
      resided_from: "2019-06-02",
      resided_until: null,
    });
  });

  it("carries resided_from from the resolved current row when rebuilding", () => {
    const current = addr({
      id: "c",
      resided_from: "2021-03-15",
      resided_until: null,
    });
    const out = buildAddressesPayloadForCurrentEdit([current], {
      ...draft,
      street: "X",
    });
    expect(out).toHaveLength(1);
    expect(out[0]?.resided_from).toBe("2021-03-15");
  });
});
