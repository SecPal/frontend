// SPDX-FileCopyrightText: 2026 SecPal
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
  FormSection,
  Input,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
} from "./ui";
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

function getEntryErrors(
  errors: ResidentialAddressHistoryErrors,
  keyPrefix: string,
  options?: { omitSuffixes?: string[] }
): string[] {
  const omit = options?.omitSuffixes ?? [];
  return Object.entries(errors)
    .filter(([key]) => {
      if (!key.startsWith(`${keyPrefix}.`)) {
        return false;
      }
      return !omit.some((suffix) => key.endsWith(suffix));
    })
    .map(([, message]) => message);
}

export type ResidentialAddressHistoryChange =
  | ResidentialAddressHistoryValue
  | ((prev: ResidentialAddressHistoryValue) => ResidentialAddressHistoryValue);

export function OnboardingResidentialAddressHistoryFields({
  value,
  errors,
  readOnly,
  onChange,
}: {
  value: ResidentialAddressHistoryValue;
  errors: ResidentialAddressHistoryErrors;
  readOnly: boolean;
  onChange: (value: ResidentialAddressHistoryChange) => void;
}) {
  const { _ } = useLingui();
  const fiveYearCoverage = currentAddressCoversFiveYearWindow(
    value.current_address.resided_from
  );
  const previousCoverageError = errors["previous_addresses.coverage"];
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

  const currentAddressErrors = getEntryErrors(errors, "current_address");

  return (
    <FormSection>
      <FieldGroup>
        <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            <Trans>Current Residential Address</Trans>
          </h3>
          <EmployeeAddressFields
            draft={addressEntryToDraft(value.current_address)}
            onChange={updateCurrentAddress}
            readOnly={readOnly}
            fieldIdPrefix="current_address"
            fieldNamePrefix="current_address"
          />
          <Field className="mt-6">
            <FieldLabel htmlFor="current_address_resided_from">
              <Trans>Living There Since</Trans> *
            </FieldLabel>
            <Input
              id="current_address_resided_from"
              name="current_address_resided_from"
              type="date"
              disabled={readOnly}
              aria-invalid={currentAddressErrors.length > 0 || undefined}
              aria-describedby={
                currentAddressErrors.length > 0
                  ? "current_address_errors"
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
          {currentAddressErrors.length > 0 ? (
            <div id="current_address_errors" className="mt-3 space-y-1">
              {currentAddressErrors.map((message) => (
                <FieldError key={message}>{message}</FieldError>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <h3 className="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            <Trans>Bewacher ID</Trans>
          </h3>
          <Field>
            <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
              <Trans>Do you currently have a Bewacher ID?</Trans>
            </span>
            <FieldDescription className="mb-3">
              <Trans>
                A Bewacher ID is issued for registration in the
                Bewacherregister.
              </Trans>
            </FieldDescription>
            <RadioGroup
              role="radiogroup"
              aria-label={_(msg`Do you currently have a Bewacher ID?`)}
              aria-invalid={hasBewacherIdQuestionError ? true : undefined}
              aria-describedby={
                hasBewacherIdQuestionError
                  ? "has_current_bewacher_id_error"
                  : undefined
              }
              className="mt-1 space-y-3"
            >
              {(["yes", "no"] as const).map((choice) => (
                <label
                  key={choice}
                  className="flex items-center gap-3 text-sm text-zinc-950 dark:text-zinc-50"
                >
                  <RadioGroupItem
                    name="has_current_bewacher_id"
                    value={choice}
                    checked={value.has_current_bewacher_id === choice}
                    disabled={readOnly}
                    aria-disabled={readOnly}
                    onChange={() => {
                      onChange((prev) => ({
                        ...prev,
                        has_current_bewacher_id: choice,
                        ...(choice === "no"
                          ? { bewacher_id: "", bewacher_id_unknown: false }
                          : {}),
                      }));
                    }}
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
                </label>
              ))}
            </RadioGroup>
            {hasBewacherIdQuestionError ? (
              <FieldError id="has_current_bewacher_id_error" className="mt-2">
                {hasBewacherIdQuestionError}
              </FieldError>
            ) : null}
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
                  bewacherIdFieldError ? "bewacher_id_error" : undefined
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
              {bewacherIdFieldError ? (
                <FieldError id="bewacher_id_error" className="mt-2">
                  {bewacherIdFieldError}
                </FieldError>
              ) : null}
            </Field>
          ) : null}

          {value.has_current_bewacher_id === "yes" &&
          value.bewacher_id.trim().length === 0 ? (
            <label className="mt-4 flex items-center gap-3 text-sm text-zinc-950 dark:text-zinc-50">
              <Checkbox
                checked={value.bewacher_id_unknown}
                disabled={readOnly}
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
          <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-4">
              <h3 className="mb-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                <Trans>Previous Residences</Trans>
              </h3>
            </div>

            {previousCoverageError ? (
              <FieldError
                id="previous_addresses_coverage_error"
                className="mb-4"
              >
                {previousCoverageError}
              </FieldError>
            ) : null}

            <div className="space-y-6">
              {value.previous_addresses.map((entry, index) => {
                const entryKeyPrefix = `previous_addresses.${index}`;
                const entryErrors = getEntryErrors(errors, entryKeyPrefix, {
                  omitSuffixes: [".resided_until"],
                });
                const residedUntilError =
                  errors[`${entryKeyPrefix}.resided_until`];
                const fieldIdPrefix = `previous_address_${index}`;

                return (
                  <section
                    key={fieldIdPrefix}
                    className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="mb-4">
                      <h4 className="mb-0 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {_(msg`Previous residence ${index + 1}`)}
                      </h4>
                    </div>

                    <EmployeeAddressFields
                      draft={addressEntryToDraft(entry)}
                      onChange={(field, nextFieldValue) =>
                        updatePreviousAddress(index, field, nextFieldValue)
                      }
                      readOnly={readOnly}
                      fieldIdPrefix={fieldIdPrefix}
                      fieldNamePrefix={fieldIdPrefix}
                    />

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
                            residedUntilError
                              ? `${fieldIdPrefix}_resided_until_error`
                              : undefined
                          }
                          value={entry.resided_until}
                        />
                        {residedUntilError ? (
                          <FieldError
                            id={`${fieldIdPrefix}_resided_until_error`}
                            className="mt-2"
                          >
                            {residedUntilError}
                          </FieldError>
                        ) : null}
                      </Field>
                    </div>

                    {entryErrors.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        {entryErrors.map((message) => (
                          <FieldError key={message}>{message}</FieldError>
                        ))}
                      </div>
                    ) : null}
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
