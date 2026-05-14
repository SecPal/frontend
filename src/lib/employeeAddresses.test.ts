// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { EmployeeAddress } from "@/types/api/employees";
import {
  buildAddressesPayloadForCurrentEdit,
  getCurrentAddressFromList,
  hasAddressDraftValue,
  mergeAddressBaseList,
} from "./employeeAddresses";

function addr(
  partial: Partial<EmployeeAddress> & { id: string }
): EmployeeAddress {
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
        state: null,
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
      state: "BE",
      resided_from: "2019-06-02",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit(
      [historical, current],
      draft
    );

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

  it("preserves state from the current row when the draft omits the state field", () => {
    const current = addr({
      id: "cur-1",
      street: "Jetztstraße",
      city: "Berlin",
      state: "BE",
      resided_from: "2019-06-02",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([current], draft);

    expect(payload[0]?.state).toBe("BE");
  });

  it("clears state when the draft explicitly provides an empty string", () => {
    const current = addr({
      id: "cur-1",
      street: "Jetztstraße",
      city: "Berlin",
      state: "BE",
      resided_from: "2019-06-02",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([current], {
      ...draft,
      state: "",
    });

    expect(payload[0]?.state).toBeNull();
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

  it("removes the current row when an existing postal address is cleared", () => {
    const historical = addr({
      id: "old-1",
      street: "Altstraße",
      house_number: "8",
      postal_code: "50667",
      city: "Köln",
      country: "DE",
      resided_from: "2018-01-01",
      resided_until: "2024-12-31",
    });
    const current = addr({
      id: "cur-1",
      street: "Jetztstraße",
      house_number: "1",
      postal_code: "10115",
      city: "Berlin",
      country: "DE",
      state: "BE",
      resided_from: "2025-01-01",
      resided_until: null,
    });

    expect(
      buildAddressesPayloadForCurrentEdit([historical, current], {
        street: "",
        houseNumber: "",
        postalCode: "",
        city: "",
        supplement: "",
        country: "",
      })
    ).toEqual([
      {
        street: "Altstraße",
        house_number: "8",
        postal_code: "50667",
        city: "Köln",
        supplement: null,
        country: "DE",
        state: null,
        resided_from: "2018-01-01",
        resided_until: "2024-12-31",
      },
    ]);
  });

  it("preserves the current row when only the state field is filled in the draft", () => {
    const current = addr({
      id: "cur-1",
      resided_from: "2023-01-01",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([current], {
      street: "",
      houseNumber: "",
      postalCode: "",
      city: "",
      supplement: "",
      country: "",
      state: "BY",
    });

    expect(payload).toHaveLength(1);
    expect(payload[0]?.state).toBe("BY");
    expect(payload[0]?.resided_until).toBeNull();
  });

  it("clears state when the country changes", () => {
    const current = addr({
      id: "cur-1",
      country: "DE",
      state: "BY",
      city: "Munich",
      resided_from: "2020-01-01",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([current], {
      street: "Rue de Rivoli",
      houseNumber: "1",
      postalCode: "75001",
      city: "Paris",
      supplement: "",
      country: "FR",
    });

    expect(payload).toHaveLength(1);
    expect(payload[0]?.state).toBeNull();
    expect(payload[0]?.country).toBe("FR");
  });

  it("preserves state when the country is unchanged", () => {
    const current = addr({
      id: "cur-1",
      country: "DE",
      state: "BY",
      city: "Munich",
      resided_from: "2020-01-01",
      resided_until: null,
    });

    const payload = buildAddressesPayloadForCurrentEdit([current], {
      street: "Maximilianstraße",
      houseNumber: "2",
      postalCode: "80539",
      city: "München",
      supplement: "",
      country: "DE",
    });

    expect(payload).toHaveLength(1);
    expect(payload[0]?.state).toBe("BY");
    expect(payload[0]?.country).toBe("DE");
  });

  it("does not invent a blank current row when only historical addresses exist", () => {
    const historical = addr({
      id: "old-1",
      street: "Altstraße",
      house_number: "8",
      postal_code: "50667",
      city: "Köln",
      country: "DE",
      resided_from: "2018-01-01",
      resided_until: "2024-12-31",
    });

    expect(
      buildAddressesPayloadForCurrentEdit([historical], {
        street: "",
        houseNumber: "",
        postalCode: "",
        city: "",
        supplement: "",
        country: "",
      })
    ).toEqual([
      {
        street: "Altstraße",
        house_number: "8",
        postal_code: "50667",
        city: "Köln",
        supplement: null,
        country: "DE",
        state: null,
        resided_from: "2018-01-01",
        resided_until: "2024-12-31",
      },
    ]);
  });

  it("does not create a current row when only the default country code is set", () => {
    const historical = addr({
      id: "old-1",
      street: "Altstraße",
      house_number: "8",
      postal_code: "50667",
      city: "Köln",
      country: "DE",
      resided_from: "2018-01-01",
      resided_until: "2024-12-31",
    });

    expect(
      buildAddressesPayloadForCurrentEdit(
        [historical],
        {
          street: "",
          houseNumber: "",
          postalCode: "",
          city: "",
          supplement: "",
          country: "DE",
        },
        { emptyCountryCodes: ["DE"] }
      )
    ).toEqual([
      {
        street: "Altstraße",
        house_number: "8",
        postal_code: "50667",
        city: "Köln",
        supplement: null,
        country: "DE",
        state: null,
        resided_from: "2018-01-01",
        resided_until: "2024-12-31",
      },
    ]);
  });
});

describe("hasAddressDraftValue", () => {
  it("treats a non-empty country as a current-row value", () => {
    expect(
      hasAddressDraftValue({
        street: "",
        houseNumber: "",
        postalCode: "",
        city: "",
        supplement: "",
        country: "DE",
      })
    ).toBe(true);
  });

  it("can ignore configured default country codes", () => {
    expect(
      hasAddressDraftValue(
        {
          street: "",
          houseNumber: "",
          postalCode: "",
          city: "",
          supplement: "",
          country: " DE ",
        },
        { emptyCountryCodes: ["de"] }
      )
    ).toBe(false);
  });
});

describe("mergeAddressBaseList", () => {
  it("returns empty array when both addresses and currentAddress are absent", () => {
    expect(mergeAddressBaseList(null, null)).toEqual([]);
    expect(mergeAddressBaseList(undefined, undefined)).toEqual([]);
  });

  it("returns addresses when currentAddress is null", () => {
    const hist = addr({ id: "h1", resided_until: "2020-01-01" });
    expect(mergeAddressBaseList([hist], null)).toEqual([hist]);
  });

  it("returns [currentAddress] when addresses is null but currentAddress is present", () => {
    const cur = addr({
      id: "c1",
      resided_until: null,
      resided_from: "2020-01-02",
    });
    expect(mergeAddressBaseList(null, cur)).toEqual([cur]);
  });

  it("does not duplicate currentAddress when already in addresses", () => {
    const cur = addr({
      id: "c1",
      resided_until: null,
      resided_from: "2020-01-02",
    });
    const hist = addr({ id: "h1", resided_until: "2020-01-01" });
    const result = mergeAddressBaseList([hist, cur], cur);
    expect(result).toHaveLength(2);
    expect(result).toEqual([hist, cur]);
  });

  it("prepends currentAddress when not in addresses so resided_from is preserved", () => {
    const cur = addr({
      id: "c1",
      resided_until: null,
      resided_from: "2021-06-01",
    });
    const hist = addr({ id: "h1", resided_until: "2021-05-31" });
    const result = mergeAddressBaseList([hist], cur);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "c1", resided_from: "2021-06-01" });
    expect(result[1]).toMatchObject({ id: "h1", resided_until: "2021-05-31" });
  });
});
