// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { Employee, EmployeeEmergencyContact } from "@/types/api";
import { fetchEmployee, updateEmployee } from "../../services/employeeApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import {
  Fieldset,
  Legend,
  FieldGroup,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";

interface EmergencyContactDraft {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notes: string;
}

type EmergencyContactErrorField = "name" | "phone" | "email";

interface EmergencyContactFieldError {
  index: number;
  field: EmergencyContactErrorField;
}

function emptyEmergencyContactDraft(): EmergencyContactDraft {
  return {
    name: "",
    relationship: "",
    phone: "",
    email: "",
    notes: "",
  };
}

function hasEmergencyContactContent(contact: EmergencyContactDraft): boolean {
  return (
    contact.name.trim().length > 0 ||
    contact.phone.trim().length > 0 ||
    contact.email.trim().length > 0 ||
    contact.relationship.trim().length > 0 ||
    contact.notes.trim().length > 0
  );
}

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
  const [addressStreet, setAddressStreet] = useState("");
  const [addressHouseNumber, setAddressHouseNumber] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressSupplement, setAddressSupplement] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressCountry, setAddressCountry] = useState("");
  const [emergencyContacts, setEmergencyContacts] = useState<
    EmergencyContactDraft[]
  >([emptyEmergencyContactDraft()]);
  const [employeeLoaded, setEmployeeLoaded] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [emergencyFieldError, setEmergencyFieldError] =
    useState<EmergencyContactFieldError | null>(null);

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
        setAddressStreet(employee.address_street ?? "");
        setAddressHouseNumber(employee.address_house_number ?? "");
        setAddressPostalCode(employee.address_postal_code ?? "");
        setAddressCity(employee.address_city ?? "");
        setAddressSupplement(employee.address_supplement ?? "");
        setAddressState(employee.address_state ?? "");
        setAddressCountry(employee.address_country ?? "");
        setEmployeeLoaded(true);

        const loadedEmergency = employee.emergency_contacts ?? [];
        if (loadedEmergency.length > 0) {
          setEmergencyContacts(
            loadedEmergency.map((contact) => ({
              name: contact.name ?? "",
              relationship: contact.relationship ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
              notes: contact.notes ?? "",
            }))
          );
        }
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
        setError("Failed to load employee");
      })
      .finally(() => {
        if (active) {
          setFetchLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  function normalizedEmergencyContacts(): EmployeeEmergencyContact[] {
    return emergencyContacts
      .map((entry) => ({
        name: entry.name.trim(),
        relationship: entry.relationship.trim() || null,
        phone: entry.phone.trim(),
        email: entry.email.trim() || null,
        notes: entry.notes.trim() || null,
      }))
      .filter(
        (contact) =>
          contact.name.length > 0 ||
          contact.phone.length > 0 ||
          (contact.email ?? "").length > 0 ||
          (contact.relationship ?? "").length > 0 ||
          (contact.notes ?? "").length > 0
      );
  }

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

    for (const [index, contact] of emergencyContacts.entries()) {
      if (!hasEmergencyContactContent(contact)) {
        continue;
      }

      if (contact.name.trim().length === 0) {
        setEmergencyFieldError({ index, field: "name" });
        setError(i18n._(msg`Emergency contact name is required.`));
        return;
      }

      if (contact.phone.trim().length === 0) {
        setEmergencyFieldError({ index, field: "phone" });
        setError(i18n._(msg`Emergency contact phone is required.`));
        return;
      }

      if (
        contact.email.trim().length > 0 &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())
      ) {
        setEmergencyFieldError({ index, field: "email" });
        setError(i18n._(msg`Please enter a valid emergency contact email.`));
        return;
      }
    }

    const normalizedContacts = normalizedEmergencyContacts();

    try {
      setLoading(true);
      setError(null);
      await updateEmployee(id, {
        email: trimmedEmail,
        phone: phone.trim(),
        address_street: addressStreet.trim() || null,
        address_house_number: addressHouseNumber.trim() || null,
        address_postal_code: addressPostalCode.trim() || null,
        address_city: addressCity.trim() || null,
        address_supplement: addressSupplement.trim() || null,
        address_state: addressState.trim() || null,
        address_country: addressCountry.trim().toUpperCase() || null,
        emergency_contacts:
          normalizedContacts.length > 0 ? normalizedContacts : null,
      });
      navigate(`/employees/${id}#contacts`);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      setError("Failed to update employee");
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
          onClick={() => navigate(id ? `/employees/${id}#contacts` : "/employees")}
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
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label>
                    <Trans>Street</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressStreet}
                    onChange={(event) => setAddressStreet(event.target.value)}
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>House Number</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressHouseNumber}
                    onChange={(event) =>
                      setAddressHouseNumber(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>Postal Code</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressPostalCode}
                    onChange={(event) =>
                      setAddressPostalCode(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>City</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressCity}
                    onChange={(event) => setAddressCity(event.target.value)}
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>Address Supplement</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressSupplement}
                    onChange={(event) =>
                      setAddressSupplement(event.target.value)
                    }
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>State</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressState}
                    onChange={(event) => setAddressState(event.target.value)}
                  />
                </Field>
                <Field>
                  <Label>
                    <Trans>Country (ISO-2)</Trans>
                  </Label>
                  <Input
                    type="text"
                    value={addressCountry}
                    onChange={(event) => setAddressCountry(event.target.value)}
                  />
                </Field>
              </div>
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
                      <Input
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
                        placeholder="Name"
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
                      <Input
                        type="text"
                        value={contact.relationship}
                        onChange={(event) =>
                          updateEmergency(
                            index,
                            "relationship",
                            event.target.value
                          )
                        }
                        placeholder="Beziehung"
                      />
                      <Input
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
                        placeholder="Telefon"
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
                      <Input
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
                        placeholder="E-Mail"
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
                    <Input
                      type="text"
                      value={contact.notes}
                      onChange={(event) =>
                        updateEmergency(index, "notes", event.target.value)
                      }
                      placeholder="Notizen"
                    />
                    <div className="flex justify-end">
                      <Button outline onClick={() => removeEmergency(index)}>
                        <Trans>Remove Contact</Trans>
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
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
