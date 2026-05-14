// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useLayoutEffect } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label,
  Description,
} from "../../components/fieldset";
import { Heading } from "../../components/heading";
import { Input } from "../../components/input";
import { Checkbox, CheckboxField } from "../../components/checkbox";
import { Radio, RadioField, RadioGroup } from "../../components/radio";
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
  | ((
      prev: ResidentialAddressHistoryValue
    ) => ResidentialAddressHistoryValue);

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
    if (coverage !== false) {
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
    <Fieldset>
      <FieldGroup>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <Heading level={3} className="mb-4">
            <Trans>Current Residential Address</Trans>
          </Heading>
          <EmployeeAddressFields
            draft={addressEntryToDraft(value.current_address)}
            onChange={updateCurrentAddress}
            readOnly={readOnly}
            fieldIdPrefix="current_address"
            fieldNamePrefix="current_address"
          />
          <Field className="mt-6">
            <Label htmlFor="current_address_resided_from">
              <Trans>Living There Since</Trans> *
            </Label>
            <Input
              id="current_address_resided_from"
              name="current_address_resided_from"
              type="date"
              disabled={readOnly}
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
          {currentAddressErrors.map((message) => (
            <ErrorMessage key={message}>{message}</ErrorMessage>
          ))}
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
          <Heading level={3} className="mb-4">
            <Trans>Bewacher ID</Trans>
          </Heading>
          <Field>
            <Label>
              <Trans>Do you currently have a Bewacher ID?</Trans>
            </Label>
            <Description className="mb-3">
              <Trans>
                A Bewacher ID is issued for registration in the Bewacherregister.
              </Trans>
            </Description>
            <RadioGroup
              aria-label={_(msg`Do you currently have a Bewacher ID?`)}
              value={value.has_current_bewacher_id}
              onChange={(next) => {
                const choice = next as "yes" | "no";
                onChange((prev) => ({
                  ...prev,
                  has_current_bewacher_id: choice,
                  ...(choice === "no"
                    ? { bewacher_id: "", bewacher_id_unknown: false }
                    : {}),
                }));
              }}
              disabled={readOnly}
              className="mt-1"
            >
              <RadioField>
                <Radio value="yes" />
                <Label>
                  <Trans>Yes</Trans>
                </Label>
              </RadioField>
              <RadioField>
                <Radio value="no" />
                <Label>
                  <Trans>No</Trans>
                </Label>
              </RadioField>
            </RadioGroup>
            {hasBewacherIdQuestionError ? (
              <ErrorMessage className="mt-2">
                {hasBewacherIdQuestionError}
              </ErrorMessage>
            ) : null}
          </Field>

          {value.has_current_bewacher_id === "yes" &&
          !value.bewacher_id_unknown ? (
            <Field className="mt-6">
              <Label htmlFor="bewacher_id">
                <Trans>Bewacher ID</Trans>
              </Label>
              <Input
                id="bewacher_id"
                name="bewacher_id"
                type="text"
                autoComplete="off"
                disabled={readOnly}
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
                <ErrorMessage className="mt-2">{bewacherIdFieldError}</ErrorMessage>
              ) : null}
            </Field>
          ) : null}

          {value.has_current_bewacher_id === "yes" &&
          value.bewacher_id.trim().length === 0 ? (
            <CheckboxField className="mt-4">
              <Checkbox
                checked={value.bewacher_id_unknown}
                disabled={readOnly}
                onChange={(checked) =>
                  onChange((prev) => ({
                    ...prev,
                    bewacher_id_unknown: checked,
                    bewacher_id: checked ? "" : prev.bewacher_id,
                  }))
                }
              />
              <Label>
                <Trans>I do not know my Bewacher ID.</Trans>
              </Label>
            </CheckboxField>
          ) : null}
        </div>

        {showPreviousResidencesSection ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="mb-4">
              <Heading level={3} className="mb-1">
                <Trans>Previous Residences</Trans>
              </Heading>
            </div>

            {previousCoverageError ? (
              <ErrorMessage className="mb-4">{previousCoverageError}</ErrorMessage>
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
                  <div
                    key={fieldIdPrefix}
                    className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="mb-4">
                      <Heading level={3} className="mb-0">
                        {_(msg`Previous residence ${index + 1}`)}
                      </Heading>
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
                        <Label htmlFor={`${fieldIdPrefix}_resided_from`}>
                          <Trans>Resided From</Trans> *
                        </Label>
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
                        <Label htmlFor={`${fieldIdPrefix}_resided_until`}>
                          <Trans>Resided Until</Trans> *
                        </Label>
                        <Input
                          id={`${fieldIdPrefix}_resided_until`}
                          name={`${fieldIdPrefix}_resided_until`}
                          type="date"
                          disabled
                          value={entry.resided_until}
                        />
                        {residedUntilError ? (
                          <ErrorMessage className="mt-2">
                            {residedUntilError}
                          </ErrorMessage>
                        ) : null}
                      </Field>
                    </div>

                    {entryErrors.map((message) => (
                      <ErrorMessage key={message}>{message}</ErrorMessage>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </FieldGroup>
    </Fieldset>
  );
}
