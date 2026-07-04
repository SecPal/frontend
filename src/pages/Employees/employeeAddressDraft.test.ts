// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import {
  buildCreateAddressPayload,
  emptyPostalAddressDraft,
  employeeAddressToDraft,
  hasPostalAddressDraftValue,
} from "./employeeAddressDraft";

describe("employeeAddressToDraft", () => {
  it("returns emptyPostalAddressDraft when address is null", () => {
    expect(employeeAddressToDraft(null)).toEqual(emptyPostalAddressDraft);
  });

  it("returns emptyPostalAddressDraft when address is undefined", () => {
    expect(employeeAddressToDraft(undefined)).toEqual(emptyPostalAddressDraft);
  });

  it("maps address fields to draft fields", () => {
    expect(
      employeeAddressToDraft({
        id: "a1",
        street: "Hauptstraße",
        house_number: "1",
        postal_code: "10115",
        city: "Berlin",
        supplement: "c/o Test",
        country: "DE",
        state: null,
        resided_from: null,
        resided_until: null,
      })
    ).toEqual({
      street: "Hauptstraße",
      houseNumber: "1",
      postalCode: "10115",
      city: "Berlin",
      supplement: "c/o Test",
      country: "DE",
    });
  });
});

describe("hasPostalAddressDraftValue", () => {
  it('treats the default "DE" country as empty for create flows', () => {
    expect(hasPostalAddressDraftValue(emptyPostalAddressDraft)).toBe(false);
  });

  it("treats a non-default country as a value", () => {
    expect(
      hasPostalAddressDraftValue({
        ...emptyPostalAddressDraft,
        country: "fr",
      })
    ).toBe(true);
  });
});

describe("buildCreateAddressPayload", () => {
  it("skips creating an untouched default address row", () => {
    expect(buildCreateAddressPayload(emptyPostalAddressDraft)).toBeUndefined();
  });
});
