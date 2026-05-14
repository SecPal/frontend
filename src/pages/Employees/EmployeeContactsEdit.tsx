// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeAddress } from "@/types/api";
import {
  buildAddressesPayloadForCurrentEdit,
  getCurrentAddressFromList,
  mergeAddressBaseList,
  type PostalAddressDraft,
} from "../../lib/employeeAddresses";
import { fetchEmployee, updateEmployee } from "../../services/employeeApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import {
  Field,
  Fieldset,
  FieldGroup,
  Label,
  Legend,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { EmployeeAddressFields } from "./EmployeeAddressFields";
import {
  employeeAddressToDraft,
  emptyPostalAddressDraft,
} from "./employeeAddressDraft";
import {
  emergencyContactsToDrafts,
  emptyEmergencyContactDraft,
  normalizeEmergencyContactDrafts,
  validateEmergencyContactDrafts,
  type EmergencyContactDraft,
  type EmergencyContactValidationError,
} from "./emergencyContactDrafts";

export function EmployeeContactsEdit() {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(id !== undefined);
  const [error, setError] = useState<string | null>(
    id === undefined ? i18n._(msg`Employee ID is missing.`) : null
  );
  const [employeeName, setEmployeeName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [addressDraft, setAddressDraft] = useState<PostalAddressDraft>(
    emptyPostalAddressDraft
  );
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactDraft[]
  >([emptyEmergencyContactDraft()]);
  /** Snapshot of address rows for PATCH (server replaces the full list). */
  const [addressRowsSnapshot, setAddressRowsSnapshot] = useState<
    EmployeeAddress[]
  >([]);
  const [employeeLoaded, setEmployeeLoaded] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [emergencyFieldError, setEmergencyFieldError] =
    useState<EmergencyContactValidationError | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;
    void fetchEmployee(id)
      .then((employee: Employee) => {
        if (!active) {
          return;
        }

        setEmployeeName(employee.full_name);
        setEmployeeNumber(employee.employee_number);
        setEmail(employee.email);
        setPhone(employee.phone ?? "");
        const rows = mergeAddressBaseList(
          employee.addresses,
          employee.current_address
        );
        setAddressRowsSnapshot(rows);
        setAddressDraft(
          employeeAddressToDraft(
            employee.current_address ?? getCurrentAddressFromList(rows)
          )
        );
        setEmergencyContacts(
          emergencyContactsToDrafts(employee.emergency_contacts)
        );
        setEmployeeLoaded(true);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        if (err instanceof Error) {
          setEmployeeLoaded(false);
          setError(err.message);
          return;
        }

        setEmployeeLoaded(false);
        setError(i18n._(msg`Failed to load employee`));
      })
      .finally(() => {
        if (active) {
          setFetchLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id, i18n]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!id) {
      setError(i18n._(msg`Employee ID is missing. Cannot submit form.`));
      return;
    }

    setEmailInvalid(false);
    setEmergencyFieldError(null);

    const trimmedEmail = email.trim();
    if (trimmedEmail.length === 0) {
      setEmailInvalid(true);
      setError(i18n._(msg`Email address is required`));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailInvalid(true);
      setError(i18n._(msg`Please enter a valid email address`));
      return;
    }

    const emergencyContactError =
      validateEmergencyContactDrafts(emergencyContacts);
    if (emergencyContactError !== null) {
      setEmergencyFieldError(emergencyContactError);
      if (emergencyContactError.field === "name") {
        setError(i18n._(msg`Emergency contact name is required.`));
        return;
      }
      if (emergencyContactError.field === "phone") {
        setError(i18n._(msg`Emergency contact phone is required.`));
        return;
      }
      setError(i18n._(msg`Please enter a valid emergency contact email.`));
      return;
    }

    const normalizedContacts =
      normalizeEmergencyContactDrafts(emergencyContacts);

    try {
      setLoading(true);
      setError(null);
      await updateEmployee(id, {
        email: trimmedEmail,
        phone: phone.trim(),
        addresses: buildAddressesPayloadForCurrentEdit(
          addressRowsSnapshot,
          addressDraft,
          { emptyCountryCodes: ["DE"] }
        ),
        emergency_contacts:
          normalizedContacts.length > 0 ? normalizedContacts : null,
      });
      navigate(`/employees/${id}#contacts`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      setError(i18n._(msg`Failed to update employee`));
    } finally {
      setLoading(false);
    }
  }

  function updateEmergency(
    index: number,
    field: keyof EmergencyContactDraft,
    value: string
  ) {
    setEmergencyContacts((prev) =>
      prev.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry
      )
    );
  }

  function removeEmergency(index: number) {
    setEmergencyContacts((prev) => {
      const remaining = prev.filter((_, entryIndex) => entryIndex !== index);
      return remaining.length > 0 ? remaining : [emptyEmergencyContactDraft()];
    });
  }

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading employee...</Trans>
        </Text>
      </div>
    );
  }

  if (!employeeLoaded) {
    return (
      <div className="space-y-4">
        <Button
          plain
          onClick={() =>
            navigate(id ? `/employees/${id}#contacts` : "/employees")
          }
        >
          <Trans>← Back to Employee</Trans>
        </Button>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          {error ?? i18n._(msg`Failed to load employee`)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Button plain onClick={() => navigate(`/employees/${id}#contacts`)}>
          <Trans>← Back to Employee</Trans>
        </Button>
      </div>

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 p-6 dark:bg-zinc-900 dark:ring-white/10">
        <Heading className="mb-6">
          <Trans>Edit Contact Details</Trans>
        </Heading>
        {employeeName && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate(`/employees/${id}`)}
              className="block w-fit cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-base/6 text-zinc-950 hover:text-zinc-950 sm:text-sm/6 dark:text-white dark:hover:text-white"
            >
              {employeeName}
            </button>
            {employeeNumber && (
              <button
                type="button"
                onClick={() => navigate(`/employees/${id}`)}
                className="block w-fit cursor-pointer border-0 bg-transparent p-0 text-left text-base/6 text-zinc-500 hover:text-zinc-500 sm:text-sm/6 dark:text-zinc-400 dark:hover:text-zinc-400"
              >
                {employeeNumber}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <Fieldset>
            <Legend>
              <Trans>Contact</Trans>
            </Legend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label>
                    <Trans>Email</Trans> *
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError(null);
                      setEmailInvalid(false);
                    }}
                    invalid={emailInvalid}
                    data-invalid={emailInvalid ? true : undefined}
                    aria-invalid={emailInvalid ? true : undefined}
                    required
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>Phone</Trans>
                  </Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          <Fieldset>
            <Legend>
              <Trans>Postal Address</Trans>
            </Legend>
            <FieldGroup>
              <EmployeeAddressFields
                draft={addressDraft}
                onChange={(field, value) =>
                  setAddressDraft((prev) => ({ ...prev, [field]: value }))
                }
                fieldIdPrefix="contacts-edit-address"
              />
            </FieldGroup>
          </Fieldset>

          <Fieldset>
            <Legend>
              <Trans>Emergency Contacts</Trans>
            </Legend>
            <FieldGroup>
              <div className="space-y-4">
                {emergencyContacts.map((contact, index) => (
                  <div
                    key={`edit-emergency-${index}`}
                    className="space-y-3 rounded-lg border border-zinc-950/10 p-4 dark:border-white/10"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label
                          htmlFor={`emergency-contact-${index}-name`}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          <Trans>Emergency Contact Name</Trans>
                        </label>
                        <Input
                          id={`emergency-contact-${index}-name`}
                          type="text"
                          value={contact.name}
                          onChange={(event) => {
                            updateEmergency(index, "name", event.target.value);
                            setError(null);
                            if (
                              emergencyFieldError?.index === index &&
                              emergencyFieldError.field === "name"
                            ) {
                              setEmergencyFieldError(null);
                            }
                          }}
                          placeholder={i18n._(msg`Name`)}
                          invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "name"
                          }
                          data-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "name"
                              ? true
                              : undefined
                          }
                          aria-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "name"
                              ? true
                              : undefined
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`emergency-contact-${index}-relationship`}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          <Trans>Emergency Contact Relationship</Trans>
                        </label>
                        <Input
                          id={`emergency-contact-${index}-relationship`}
                          type="text"
                          value={contact.relationship}
                          onChange={(event) =>
                            updateEmergency(
                              index,
                              "relationship",
                              event.target.value
                            )
                          }
                          placeholder={i18n._(msg`Relationship`)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`emergency-contact-${index}-phone`}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          <Trans>Emergency Contact Phone</Trans>
                        </label>
                        <Input
                          id={`emergency-contact-${index}-phone`}
                          type="tel"
                          value={contact.phone}
                          onChange={(event) => {
                            updateEmergency(index, "phone", event.target.value);
                            setError(null);
                            if (
                              emergencyFieldError?.index === index &&
                              emergencyFieldError.field === "phone"
                            ) {
                              setEmergencyFieldError(null);
                            }
                          }}
                          placeholder={i18n._(msg`Phone`)}
                          invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "phone"
                          }
                          data-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "phone"
                              ? true
                              : undefined
                          }
                          aria-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "phone"
                              ? true
                              : undefined
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor={`emergency-contact-${index}-email`}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          <Trans>Emergency Contact Email</Trans>
                        </label>
                        <Input
                          id={`emergency-contact-${index}-email`}
                          type="email"
                          value={contact.email}
                          onChange={(event) => {
                            updateEmergency(index, "email", event.target.value);
                            setError(null);
                            if (
                              emergencyFieldError?.index === index &&
                              emergencyFieldError.field === "email"
                            ) {
                              setEmergencyFieldError(null);
                            }
                          }}
                          placeholder={i18n._(msg`Email`)}
                          invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "email"
                          }
                          data-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "email"
                              ? true
                              : undefined
                          }
                          aria-invalid={
                            emergencyFieldError?.index === index &&
                            emergencyFieldError.field === "email"
                              ? true
                              : undefined
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor={`emergency-contact-${index}-notes`}
                        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        <Trans>Emergency Contact Notes</Trans>
                      </label>
                      <Input
                        id={`emergency-contact-${index}-notes`}
                        type="text"
                        value={contact.notes}
                        onChange={(event) =>
                          updateEmergency(index, "notes", event.target.value)
                        }
                        placeholder={i18n._(msg`Notes`)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        outline
                        onClick={() => removeEmergency(index)}
                      >
                        <Trans>Remove Contact</Trans>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  outline
                  onClick={() =>
                    setEmergencyContacts((prev) => [
                      ...prev,
                      emptyEmergencyContactDraft(),
                    ])
                  }
                >
                  <Trans>Add Contact</Trans>
                </Button>
              </div>
            </FieldGroup>
          </Fieldset>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              outline
              onClick={() => navigate(`/employees/${id}#contacts`)}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Trans>Saving...</Trans> : <Trans>Save</Trans>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeContactsEdit;
