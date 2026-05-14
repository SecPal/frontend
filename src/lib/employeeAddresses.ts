// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  EmployeeAddress,
  EmployeeAddressInput,
} from "@/types/api/employees";

/** Form draft shape shared by contact editors (matches prior flat-field editors). */
export interface PostalAddressDraft {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
  supplement: string;
  country: string;
  state?: string;
}

interface HasAddressDraftValueOptions {
  emptyCountryCodes?: string[];
}

export function getCurrentAddressFromList(
  list: EmployeeAddress[] | null | undefined
): EmployeeAddress | null {
  if (!list?.length) {
    return null;
  }

  return (
    list.find((a) => a.resided_until == null || a.resided_until === "") ?? null
  );
}

export function hasAddressDraftValue(
  draft: PostalAddressDraft,
  options: HasAddressDraftValueOptions = {}
): boolean {
  const trimmedCountry = draft.country.trim();
  const emptyCountryCodes = options.emptyCountryCodes?.map((code) =>
    code.trim().toUpperCase()
  );

  return (
    draft.street.trim().length > 0 ||
    draft.houseNumber.trim().length > 0 ||
    draft.postalCode.trim().length > 0 ||
    draft.city.trim().length > 0 ||
    draft.supplement.trim().length > 0 ||
    (trimmedCountry.length > 0 &&
      !emptyCountryCodes?.includes(trimmedCountry.toUpperCase())) ||
    (draft.state?.trim().length ?? 0) > 0
  );
}

function rowToInput(a: EmployeeAddress): EmployeeAddressInput {
  return {
    street: a.street ?? null,
    house_number: a.house_number ?? null,
    postal_code: a.postal_code ?? null,
    city: a.city ?? null,
    supplement: a.supplement ?? null,
    country: a.country ?? null,
    state: a.state ?? null,
    resided_from: a.resided_from ?? null,
    resided_until: a.resided_until ?? null,
  };
}

/**
 * Builds the canonical address base list from `addresses` supplemented by
 * `currentAddress` when absent or not already included by id. This ensures
 * `resided_from` is preserved when the API returns `current_address` without
 * the full `addresses` relation.
 */
export function mergeAddressBaseList(
  addresses: EmployeeAddress[] | null | undefined,
  currentAddress: EmployeeAddress | null | undefined
): EmployeeAddress[] {
  const list = addresses ?? [];
  if (currentAddress && !list.some((r) => r.id === currentAddress.id)) {
    return [currentAddress, ...list];
  }
  return list;
}

/**
 * Builds the `addresses` payload for PATCH when only the current residence is edited.
 * Historical rows (non-null `resided_until`) are preserved; the current row is replaced.
 *
 * Pass `emptyCountryCodes` to treat specific country codes (e.g. `["DE"]`) as a
 * non-value so that a form defaulted to Germany is not treated as a filled address.
 */
export function buildAddressesPayloadForCurrentEdit(
  addressRows: EmployeeAddress[],
  draft: PostalAddressDraft,
  options: { emptyCountryCodes?: string[] } = {}
): EmployeeAddressInput[] {
  const historical = addressRows.filter(
    (a) => a.resided_until != null && a.resided_until !== ""
  );
  const current = getCurrentAddressFromList(addressRows);
  const shouldIncludeCurrentRow = hasAddressDraftValue(draft, {
    emptyCountryCodes: options.emptyCountryCodes,
  });
  const normalizedState =
    draft.state !== undefined
      ? draft.state.trim() || null
      : current?.state || null;

  if (!shouldIncludeCurrentRow) {
    return historical.map((a) => rowToInput(a));
  }

  return [
    ...historical.map((a) => rowToInput(a)),
    {
      street: draft.street.trim() || null,
      house_number: draft.houseNumber.trim() || null,
      postal_code: draft.postalCode.trim() || null,
      city: draft.city.trim() || null,
      supplement: draft.supplement.trim() || null,
      country: draft.country.trim().toUpperCase() || null,
      state: normalizedState,
      resided_from: current?.resided_from ?? null,
      resided_until: null,
    },
  ];
}
