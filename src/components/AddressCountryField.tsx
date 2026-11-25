// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { useMemo } from "react";
import { getCountrySelectOptions } from "@/lib/iso3166CountryOptions";
import { Field, SearchableCommandPopover } from "@/ui";

interface AddressCountryFieldProps {
  name: string;
  value: string;
  onChange: (countryCode: string) => void;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  errorMessage?: string;
}

export function AddressCountryField({
  name,
  value,
  onChange,
  required = false,
  disabled,
  invalid,
  describedBy,
  errorMessage,
}: AddressCountryFieldProps) {
  const { i18n, _ } = useLingui();
  const countryOptions = useMemo(
    () =>
      getCountrySelectOptions(i18n.locale).map(({ code, label }) => ({
        value: code,
        label,
      })),
    [i18n.locale]
  );
  const code = value.trim().toUpperCase();
  const selectedCode = code.length === 2 ? code : undefined;
  // Keep a saved code selectable even when it is outside the standard list.
  const options =
    selectedCode &&
    !countryOptions.some((option) => option.value === selectedCode)
      ? [...countryOptions, { value: selectedCode, label: selectedCode }]
      : countryOptions;
  const label = _(msg`Country`);
  const placeholder = _(msg`Search or select country`);

  return (
    <Field>
      <SearchableCommandPopover
        slotPrefix="address"
        name={name}
        label={required ? `${label} *` : label}
        options={options}
        value={selectedCode}
        onValueChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={placeholder}
        emptyMessage={_(msg`No results found`)}
        required={required}
        disabled={disabled}
        invalid={invalid}
        describedBy={describedBy}
        errorMessage={errorMessage}
      />
    </Field>
  );
}
