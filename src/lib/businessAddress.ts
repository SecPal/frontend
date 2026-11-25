// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Address } from "@/types/api";
import { DEFAULT_ADDRESS_COUNTRY } from "./iso3166CountryOptions";

export type BusinessAddressField = Exclude<
  keyof Address,
  "latitude" | "longitude"
>;

export const emptyBusinessAddress: Address = {
  street: "",
  house_number: null,
  postal_code: "",
  city: "",
  country: DEFAULT_ADDRESS_COUNTRY,
};

export function formatStreetLine(address: Address): string {
  return [address.street, address.house_number].filter(Boolean).join(" ");
}

export function formatBusinessAddress(address: Address): string {
  return [
    formatStreetLine(address),
    `${address.postal_code} ${address.city}`.trim(),
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}
