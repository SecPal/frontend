// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  buildCreateAddressPayload,
  emptyPostalAddressDraft,
  hasPostalAddressDraftValue,
} from "./employeeAddressDraft";

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
