// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmployeeAddress, EmployeeAddressInput } from "@/types/api";
import {
  hasAddressDraftValue,
  type PostalAddressDraft,
} from "../../lib/employeeAddresses";
import { DEFAULT_ADDRESS_COUNTRY } from "@/lib/iso3166CountryOptions";

export const emptyPostalAddressDraft: PostalAddressDraft = {
  street: "",
  houseNumber: "",
  postalCode: "",
  city: "",
  supplement: "",
  country: DEFAULT_ADDRESS_COUNTRY,
};

export function employeeAddressToDraft(
  address: EmployeeAddress | null | undefined
): PostalAddressDraft {
  if (!address) {
    return emptyPostalAddressDraft;
  }

  return {
    street: address.street ?? "",
    houseNumber: address.house_number ?? "",
    postalCode: address.postal_code ?? "",
    city: address.city ?? "",
    supplement: address.supplement ?? "",
    country: address.country ?? "",
  };
}

export function hasPostalAddressDraftValue(draft: PostalAddressDraft): boolean {
  return hasAddressDraftValue(draft, {
    emptyCountryCodes: [DEFAULT_ADDRESS_COUNTRY],
  });
}

export function buildCreateAddressPayload(
  draft: PostalAddressDraft
): EmployeeAddressInput[] | undefined {
  if (!hasPostalAddressDraftValue(draft)) {
    return undefined;
  }

  return [
    {
      street: draft.street.trim() || null,
      house_number: draft.houseNumber.trim() || null,
      postal_code: draft.postalCode.trim() || null,
      city: draft.city.trim() || null,
      supplement: draft.supplement.trim() || null,
      country: draft.country.trim().toUpperCase() || null,
      state: null,
      resided_from: null,
      resided_until: null,
    },
  ];
}
