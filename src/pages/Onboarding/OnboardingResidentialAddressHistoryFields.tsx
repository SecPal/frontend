// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLayoutEffect } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  Field,
  FieldGroup,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  OnboardingCheckbox as Checkbox,
  OnboardingFormSection as FormSection,
  OnboardingRadioGroup as RadioGroup,
  OnboardingRadioGroupItem as RadioGroupItem,
} from "@/ui";
import type { PostalAddressDraft } from "../../lib/employeeAddresses";
import { EmployeeAddressFields } from "../Employees/EmployeeAddressFields";
import {
  currentAddressCoversFiveYearWindow,
  shouldShowPreviousResidencesForBewacher,
  syncPreviousResidenceRows,
  type ResidentialAddressEntryValue,
  type ResidentialAddressHistoryErrors,
  type ResidentialAddressHistoryValue,
} from "./onboardingResidentialAddressHistory";

function addressEntryToDraft(
  value: ResidentialAddressEntryValue
): PostalAddressDraft {
  return {
    street: value.street,
    houseNumber: value.house_number,
    postalCode: value.postal_code,
    city: value.city,
    supplement: value.supplement,
    country: value.country,
  };
}

function draftToAddressEntry(
  value: ResidentialAddressEntryValue,
  field: keyof PostalAddressDraft,
  nextFieldValue: string
): ResidentialAddressEntryValue {
  switch (field) {
    case "street":
      return { ...value, street: nextFieldValue };
    case "houseNumber":
      return { ...value, house_number: nextFieldValue };
    case "postalCode":
      return { ...value, postal_code: nextFieldValue };
    case "city":
      return { ...value, city: nextFieldValue };
    case "supplement":
      return { ...value, supplement: nextFieldValue };
    case "country":
      return { ...value, country: nextFieldValue };
    case "state":
      return value;
  }
}

const addressFieldKeys = {
  postalCode: "postal_code",
  city: "city",
  street: "street",
  houseNumber: "house_number",
  supplement: "supplement",
  country: "country",
} as const;

function getEntryErrorKeys(
  errors: ResidentialAddressHistoryErrors,
  keyPrefix: string
): string[] {
  const fieldOrder: string[] = [
    ...Object.values(addressFieldKeys),
    "resided_from",
    "resided_until",
  ];
  return Object.keys(errors)
    .filter((key) => key.startsWith(`${keyPrefix}.`))
    .sort((left, right) => {
      const rank = (key: string) => {
        const index = fieldOrder.indexOf(key.slice(keyPrefix.length + 1));
        return index < 0 ? fieldOrder.length : index;
      };
      return rank(left) - rank(right);
    });
}

function getInvalidAddressFields(
  errors: ResidentialAddressHistoryErrors,
  keyPrefix: string
): Partial<Record<keyof PostalAddressDraft, boolean>> {
  return Object.fromEntries(
    Object.entries(addressFieldKeys).map(([field, suffix]) => [
      field,
      Boolean(errors[`${keyPrefix}.${suffix}`]),
    ])
  );
}

function getAddressFieldDescriptions(
  firstErrorKey: string | undefined,
  keyPrefix: string,
  errorId: string
): Partial<Record<keyof PostalAddressDraft, string>> {
  return Object.fromEntries(
    Object.entries(addressFieldKeys)
      .filter(([, suffix]) => firstErrorKey === `${keyPrefix}.${suffix}`)
      .map(([field]) => [field, errorId])
  );
}

export type ResidentialAddressHistoryChange =
  | ResidentialAddressHistoryValue
  | ((prev: ResidentialAddressHistoryValue) => ResidentialAddressHistoryValue);

interface OnboardingResidentialAddressHistoryFieldsProps {
  value: ResidentialAddressHistoryValue;
  errors: ResidentialAddressHistoryErrors;
  readOnly: boolean;
  onChange: (value: ResidentialAddressHistoryChange) => void;
}

export function OnboardingResidentialAddressHistoryFields({
  value,
  errors,
  readOnly,
  onChange,
}: OnboardingResidentialAddressHistoryFieldsProps) {
  const { _ } = useLingui();
  const fiveYearCoverage = currentAddressCoversFiveYearWindow(
    value.current_address.resided_from
  );
  const showPreviousResidencesSection =
    fiveYearCoverage === false &&
    shouldShowPreviousResidencesForBewacher(value);
  const hasBewacherIdQuestionError = errors["has_current_bewacher_id"];
  const bewacherIdFieldError = errors["bewacher_id"];

  useLayoutEffect(() => {
    if (readOnly) {
      return;
    }
    if (!shouldShowPreviousResidencesForBewacher(value)) {
      if (value.previous_addresses.length > 0) {
        onChange((prev) => ({ ...prev, previous_addresses: [] }));
      }
      return;
    }
    const coverage = currentAddressCoversFiveYearWindow(
      value.current_address.resided_from
    );
    if (coverage === true) {
      if (value.previous_addresses.length > 0) {
        onChange((prev) => ({ ...prev, previous_addresses: [] }));
      }
      return;
    }
    const synced = syncPreviousResidenceRows(value);
    if (synced) {
      onChange(synced);
    }
  }, [readOnly, value, onChange]);

  function updateCurrentAddress(
    field: keyof PostalAddressDraft,
    nextFieldValue: string
  ) {
    onChange((prev) => ({
      ...prev,
      current_address: draftToAddressEntry(
        prev.current_address,
        field,
        nextFieldValue
      ),
    }));
  }

  function updatePreviousAddress(
    index: number,
    field: keyof PostalAddressDraft,
    nextFieldValue: string
  ) {
    onChange((prev) => ({
      ...prev,
      previous_addresses: prev.previous_addresses.map((entry, entryIndex) =>
        entryIndex === index
          ? draftToAddressEntry(entry, field, nextFieldValue)
          : entry
      ),
    }));
  }

  function updatePreviousAddressDate(
    index: number,
    field: "resided_from" | "resided_until",
    nextFieldValue: string
  ) {
    onChange((prev) => ({
      ...prev,
      previous_addresses: prev.previous_addresses.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: nextFieldValue } : entry
      ),
    }));
  }

  const firstErrorKey = [
    ...getEntryErrorKeys(errors, "current_address"),
    "has_current_bewacher_id",
    "bewacher_id",
    "bewacher_id_unknown",
    ...value.previous_addresses.flatMap((_, index) =>
      getEntryErrorKeys(errors, `previous_addresses.${index}`)
    ),
    "previous_addresses.coverage",
  ].find((key) => Boolean(errors[key]));
  const errorSummaryId = "residential_address_history_error";

  return (
    <FormSection>
      {firstErrorKey ? (
        <FieldError id={errorSummaryId} aria-live="polite" aria-atomic="true">
          {errors[firstErrorKey]}
        </FieldError>
      ) : null}
      <FieldGroup>
        <section className="rounded-md border border-border bg-muted p-4">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            <Trans>Current Residential Address</Trans>
          </h3>
          <FieldGroup>
            <EmployeeAddressFields
              draft={addressEntryToDraft(value.current_address)}
              onChange={updateCurrentAddress}
              readOnly={readOnly}
              fieldIdPrefix="current_address"
              fieldNamePrefix="current_address"
              invalidFields={getInvalidAddressFields(errors, "current_address")}
              fieldDescriptions={getAddressFieldDescriptions(
                firstErrorKey,
                "current_address",
                errorSummaryId
              )}
            />
          </FieldGroup>
          <Field className="mt-6">
            <FieldLabel htmlFor="current_address_resided_from">
              <Trans>Living There Since</Trans> *
            </FieldLabel>
            <Input
              id="current_address_resided_from"
              name="current_address_resided_from"
              type="date"
              disabled={readOnly}
              aria-invalid={
                Boolean(errors["current_address.resided_from"]) || undefined
              }
              aria-describedby={
                firstErrorKey === "current_address.resided_from"
                  ? errorSummaryId
                  : undefined
              }
              value={value.current_address.resided_from}
              onChange={(event) =>
                onChange((prev) => ({
                  ...prev,
                  current_address: {
                    ...prev.current_address,
                    resided_from: event.target.value,
                  },
                }))
              }
            />
          </Field>
        </section>

        <section className="rounded-md border border-border bg-muted p-4">
          <h3 className="mb-4 text-base font-semibold text-foreground">
            <Trans>Bewacher ID</Trans>
          </h3>
          <Field>
            <span className="text-sm font-medium text-foreground">
              <Trans>Do you currently have a Bewacher ID?</Trans>
            </span>
            <FieldDescription className="mb-3">
              <Trans>
                A Bewacher ID is issued for registration in the
                Bewacherregister.
              </Trans>
            </FieldDescription>
            <RadioGroup
              aria-label={_(msg`Do you currently have a Bewacher ID?`)}
              aria-invalid={hasBewacherIdQuestionError ? true : undefined}
              aria-describedby={
                firstErrorKey === "has_current_bewacher_id"
                  ? errorSummaryId
                  : undefined
              }
              className="mt-1 space-y-3"
              name="has_current_bewacher_id"
              value={value.has_current_bewacher_id ?? ""}
              onValueChange={(nextValue) => {
                if (nextValue !== "yes" && nextValue !== "no") {
                  return;
                }

                onChange((prev) => ({
                  ...prev,
                  has_current_bewacher_id: nextValue,
                  ...(nextValue === "no"
                    ? { bewacher_id: "", bewacher_id_unknown: false }
                    : {}),
                }));
              }}
            >
              {(["yes", "no"] as const).map((choice) => (
                <FieldLabel
                  key={choice}
                  htmlFor={`has_current_bewacher_id_${choice}`}
                  className="flex items-center gap-3 text-sm text-foreground"
                >
                  <RadioGroupItem
                    id={`has_current_bewacher_id_${choice}`}
                    value={choice}
                    disabled={readOnly}
                    aria-disabled={readOnly}
                    aria-invalid={
                      Boolean(hasBewacherIdQuestionError) || undefined
                    }
                  />
                  {choice === "yes" ? (
                    <span>
                      <Trans>Yes</Trans>
                    </span>
                  ) : (
                    <span>
                      <Trans>No</Trans>
                    </span>
                  )}
                </FieldLabel>
              ))}
            </RadioGroup>
          </Field>

          {value.has_current_bewacher_id === "yes" &&
          !value.bewacher_id_unknown ? (
            <Field className="mt-6">
              <FieldLabel htmlFor="bewacher_id">
                <Trans>Bewacher ID</Trans>
              </FieldLabel>
              <Input
                id="bewacher_id"
                name="bewacher_id"
                type="text"
                autoComplete="off"
                disabled={readOnly}
                aria-invalid={bewacherIdFieldError ? true : undefined}
                aria-describedby={
                  firstErrorKey === "bewacher_id" ? errorSummaryId : undefined
                }
                value={value.bewacher_id}
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    bewacher_id: event.target.value,
                    bewacher_id_unknown: false,
                  }))
                }
              />
            </Field>
          ) : null}

          {value.has_current_bewacher_id === "yes" &&
          value.bewacher_id.trim().length === 0 ? (
            <label className="mt-4 flex items-center gap-3 text-sm text-foreground">
              <Checkbox
                checked={value.bewacher_id_unknown}
                disabled={readOnly}
                aria-invalid={Boolean(errors.bewacher_id_unknown) || undefined}
                aria-describedby={
                  firstErrorKey === "bewacher_id_unknown"
                    ? errorSummaryId
                    : undefined
                }
                onChange={(event) =>
                  onChange((prev) => ({
                    ...prev,
                    bewacher_id_unknown: event.target.checked,
                    bewacher_id: event.target.checked ? "" : prev.bewacher_id,
                  }))
                }
              />
              <span>
                <Trans>I do not know my Bewacher ID.</Trans>
              </span>
            </label>
          ) : null}
        </section>

        {showPreviousResidencesSection ? (
          <section className="rounded-md border border-border bg-muted p-4">
            <div className="mb-4">
              <h3 className="mb-1 text-base font-semibold text-foreground">
                <Trans>Previous Residences</Trans>
              </h3>
            </div>

            <div className="space-y-6">
              {value.previous_addresses.map((entry, index) => {
                const entryKeyPrefix = `previous_addresses.${index}`;
                const residedUntilError =
                  errors[`${entryKeyPrefix}.resided_until`];
                const fieldIdPrefix = `previous_address_${index}`;

                return (
                  <section
                    key={fieldIdPrefix}
                    className="rounded-md border border-border bg-background p-4"
                  >
                    <div className="mb-4">
                      <h4 className="mb-0 text-sm font-semibold text-foreground">
                        {_(msg`Previous residence ${index + 1}`)}
                      </h4>
                    </div>

                    <FieldGroup>
                      <EmployeeAddressFields
                        draft={addressEntryToDraft(entry)}
                        onChange={(field, nextFieldValue) =>
                          updatePreviousAddress(index, field, nextFieldValue)
                        }
                        readOnly={readOnly}
                        fieldIdPrefix={fieldIdPrefix}
                        fieldNamePrefix={fieldIdPrefix}
                        invalidFields={getInvalidAddressFields(
                          errors,
                          entryKeyPrefix
                        )}
                        fieldDescriptions={getAddressFieldDescriptions(
                          firstErrorKey,
                          entryKeyPrefix,
                          errorSummaryId
                        )}
                      />
                    </FieldGroup>

                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor={`${fieldIdPrefix}_resided_from`}>
                          <Trans>Resided From</Trans> *
                        </FieldLabel>
                        <Input
                          id={`${fieldIdPrefix}_resided_from`}
                          name={`${fieldIdPrefix}_resided_from`}
                          type="date"
                          disabled={readOnly}
                          aria-invalid={
                            Boolean(errors[`${entryKeyPrefix}.resided_from`]) ||
                            undefined
                          }
                          aria-describedby={
                            firstErrorKey === `${entryKeyPrefix}.resided_from`
                              ? errorSummaryId
                              : undefined
                          }
                          value={entry.resided_from}
                          onChange={(event) =>
                            updatePreviousAddressDate(
                              index,
                              "resided_from",
                              event.target.value
                            )
                          }
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`${fieldIdPrefix}_resided_until`}>
                          <Trans>Resided Until</Trans> *
                        </FieldLabel>
                        <Input
                          id={`${fieldIdPrefix}_resided_until`}
                          name={`${fieldIdPrefix}_resided_until`}
                          type="date"
                          disabled
                          aria-invalid={residedUntilError ? true : undefined}
                          aria-describedby={
                            firstErrorKey === `${entryKeyPrefix}.resided_until`
                              ? errorSummaryId
                              : undefined
                          }
                          value={entry.resided_until}
                        />
                      </Field>
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        ) : null}
      </FieldGroup>
    </FormSection>
  );
}
