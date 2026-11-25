// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Trans } from "@lingui/react/macro";
import { AddressAutocompleteFields } from "@/components/AddressAutocompleteFields";
import { AddressCountryField } from "@/components/AddressCountryField";
import { Field, FieldLabel as Label, Input } from "@/ui";
import type { PostalAddressDraft } from "../../lib/employeeAddresses";

const draftFields = {
  street: "street",
  city: "city",
  postal_code: "postalCode",
  house_number: "houseNumber",
} as const;

interface EmployeeAddressFieldsProps {
  draft: PostalAddressDraft;
  onChange: (field: keyof PostalAddressDraft, value: string) => void;
  readOnly?: boolean;
  fieldIdPrefix?: string;
  fieldNamePrefix?: string;
  invalidFields?: Partial<Record<keyof PostalAddressDraft, boolean>>;
  fieldDescriptions?: Partial<Record<keyof PostalAddressDraft, string>>;
}

export function EmployeeAddressFields({
  draft,
  onChange,
  readOnly = false,
  fieldIdPrefix = "address",
  fieldNamePrefix = fieldIdPrefix,
  invalidFields = {},
  fieldDescriptions = {},
}: EmployeeAddressFieldsProps) {
  const fieldId = (suffix: string) => `${fieldIdPrefix}_${suffix}`;
  const fieldName = (suffix: string) => `${fieldNamePrefix}_${suffix}`;

  return (
    <>
      <AddressAutocompleteFields
        address={{
          street: draft.street,
          house_number: draft.houseNumber,
          postal_code: draft.postalCode,
          city: draft.city,
          country: draft.country,
        }}
        onChange={(field, value) => onChange(draftFields[field], value)}
        readOnly={readOnly}
        fieldIdPrefix={fieldIdPrefix}
        fieldNamePrefix={fieldNamePrefix}
        invalidFields={{
          street: invalidFields.street,
          postal_code: invalidFields.postalCode,
          city: invalidFields.city,
          house_number: invalidFields.houseNumber,
        }}
        fieldDescriptions={{
          street: fieldDescriptions.street,
          postal_code: fieldDescriptions.postalCode,
          city: fieldDescriptions.city,
          house_number: fieldDescriptions.houseNumber,
        }}
      />

      <Field>
        <Label htmlFor={fieldId("supplement")}>
          <Trans>Address Supplement</Trans>
        </Label>
        <Input
          id={fieldId("supplement")}
          name={fieldName("supplement")}
          aria-invalid={invalidFields.supplement || undefined}
          aria-describedby={fieldDescriptions.supplement}
          disabled={readOnly}
          value={draft.supplement}
          onChange={(event) => onChange("supplement", event.target.value)}
        />
      </Field>

      <AddressCountryField
        name={fieldName("country")}
        value={draft.country}
        onChange={(countryCode) => onChange("country", countryCode)}
        disabled={readOnly}
        invalid={invalidFields.country}
        describedBy={fieldDescriptions.country}
      />
    </>
  );
}
