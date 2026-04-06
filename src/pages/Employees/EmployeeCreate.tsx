// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type { EmployeeFormData, EmployeeStatus } from "@/types/api";
import { createEmployee } from "../../services/employeeApi";
import { ApiError } from "../../services/ApiError";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types/organizational";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import {
  ErrorMessage,
  Fieldset,
  Legend,
  FieldGroup,
  Field,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Switch } from "../../components/switch";
import { EmployeeStatusOptions } from "./EmployeeStatusOptions";

type EmployeeFormField = keyof EmployeeFormData;
type EmployeeFormErrors = Partial<Record<EmployeeFormField, string>>;

const fieldOrder: EmployeeFormField[] = [
  "first_name",
  "last_name",
  "email",
  "date_of_birth",
  "position",
  "contract_start_date",
  "organizational_unit_id",
  "management_level",
  "status",
  "send_invitation",
  "contract_type",
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Employee Create Form
 */
export function EmployeeCreate() {
  const { i18n } = useLingui();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  // Display values for date inputs
  const [birthDateDisplay, setBirthDateDisplay] = useState("");
  const [contractDateDisplay, setContractDateDisplay] = useState("");
  const [fieldErrors, setFieldErrors] = useState<EmployeeFormErrors>({});
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [organizationalUnits, setOrganizationalUnits] = useState<
    OrganizationalUnit[]
  >([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [isLeadership, setIsLeadership] = useState(false);
  const fieldRefs = useRef<
    Partial<Record<EmployeeFormField, HTMLElement | null>>
  >({});
  const [formData, setFormData] = useState<EmployeeFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    position: "",
    contract_start_date: "",
    organizational_unit_id: "",
    management_level: 0,
    status: "pre_contract",
    contract_type: "full_time",
    send_invitation: true,
  });

  const inviteSupported = formData.status === "pre_contract";

  function getFieldErrorId(field: EmployeeFormField): string {
    return `${field}-error`;
  }

  function getAriaDescribedBy(field: EmployeeFormField): string | undefined {
    return fieldErrors[field] ? getFieldErrorId(field) : undefined;
  }

  function setFieldRef(field: EmployeeFormField, element: HTMLElement | null) {
    fieldRefs.current[field] = element;
  }

  function focusFirstInvalidField(errors: EmployeeFormErrors) {
    const firstInvalidField = fieldOrder.find((field) => errors[field]);
    if (!firstInvalidField) {
      return;
    }

    fieldRefs.current[firstInvalidField]?.focus();
  }

  function clearFieldError(field: EmployeeFormField) {
    setFieldErrors((prev) => {
      if (!prev[field]) {
        return prev;
      }

      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function clearSubmitMessages() {
    if (submitFeedback) {
      setSubmitFeedback(null);
    }

    if (error) {
      setError(null);
    }
  }

  function parseApiValidationErrors(
    apiErrors: Record<string, string[]>
  ): EmployeeFormErrors {
    const nextErrors: EmployeeFormErrors = {};

    for (const field of fieldOrder) {
      const messages = apiErrors[field];
      if (messages && messages.length > 0) {
        nextErrors[field] = messages[0];
      }
    }

    return nextErrors;
  }

  function validateForm(): {
    errors: EmployeeFormErrors;
    normalizedData: EmployeeFormData;
    normalizedBirthDateDisplay: string;
    normalizedContractDateDisplay: string;
  } {
    const errors: EmployeeFormErrors = {};
    const normalizedData: EmployeeFormData = {
      ...formData,
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone?.trim() ?? "",
      position: formData.position?.trim() ?? "",
      organizational_unit_id: formData.organizational_unit_id.trim(),
      management_level: isLeadership ? formData.management_level : 0,
      send_invitation:
        formData.status === "pre_contract"
          ? Boolean(formData.send_invitation)
          : false,
    };
    let normalizedBirthDateDisplay = birthDateDisplay.trim();
    let normalizedContractDateDisplay = contractDateDisplay.trim();

    if (!normalizedData.first_name) {
      errors.first_name = i18n._(msg`First name is required`);
    }

    if (!normalizedData.last_name) {
      errors.last_name = i18n._(msg`Last name is required`);
    }

    if (!normalizedData.email) {
      errors.email = i18n._(msg`Email address is required`);
    } else if (!emailPattern.test(normalizedData.email)) {
      errors.email = i18n._(msg`Please enter a valid email address`);
    }

    if (!normalizedBirthDateDisplay) {
      errors.date_of_birth = i18n._(msg`Date of birth is required`);
    } else {
      const birthDate = parseDateToISO(normalizedBirthDateDisplay, i18n.locale);
      if (!birthDate.valid) {
        errors.date_of_birth =
          i18n.locale === "de"
            ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
            : "Invalid date. Please use format MM/DD/YYYY";
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const parsedBirthDate = new Date(`${birthDate.iso}T00:00:00`);
        if (parsedBirthDate >= today) {
          errors.date_of_birth = i18n._(msg`Date of birth must be in the past`);
        } else {
          normalizedData.date_of_birth = birthDate.iso;
          normalizedBirthDateDisplay = birthDate.formatted;
        }
      }
    }

    if (!normalizedData.position) {
      errors.position = i18n._(msg`Position is required`);
    }

    if (!normalizedContractDateDisplay) {
      errors.contract_start_date = i18n._(msg`Contract start date is required`);
    } else {
      const contractDate = parseDateToISO(
        normalizedContractDateDisplay,
        i18n.locale
      );
      if (!contractDate.valid) {
        errors.contract_start_date =
          i18n.locale === "de"
            ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
            : "Invalid date. Please use format MM/DD/YYYY";
      } else {
        normalizedData.contract_start_date = contractDate.iso;
        normalizedContractDateDisplay = contractDate.formatted;
      }
    }

    if (unitsLoading) {
      errors.organizational_unit_id = i18n._(
        msg`Organizational units are still loading. Please wait a moment and try again.`
      );
    } else if (!normalizedData.organizational_unit_id) {
      errors.organizational_unit_id = i18n._(
        msg`Organizational unit is required`
      );
    }

    if (!normalizedData.status) {
      errors.status = i18n._(msg`Status is required`);
    }

    if (!normalizedData.contract_type) {
      errors.contract_type = i18n._(msg`Contract type is required`);
    }

    if (isLeadership) {
      if (
        Number.isNaN(normalizedData.management_level) ||
        normalizedData.management_level < 1
      ) {
        errors.management_level = i18n._(
          msg`Management level is required when leadership position is enabled`
        );
      } else if (normalizedData.management_level > 255) {
        errors.management_level = i18n._(
          msg`Management level must be between 1 and 255`
        );
      }
    }

    return {
      errors,
      normalizedData,
      normalizedBirthDateDisplay,
      normalizedContractDateDisplay,
    };
  }

  // Helper function to parse display format to ISO date with validation
  const parseDateToISO = (
    displayDate: string,
    locale: string
  ): { iso: string; formatted: string; valid: boolean } => {
    if (!displayDate) return { iso: "", formatted: "", valid: false };

    let parts: string[];
    let day: number, month: number, year: number;

    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
        parts = displayDate.split("-");
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return { iso: "", formatted: displayDate, valid: false };
        }
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        day = parseInt(parts[2], 10);
      } else if (locale === "de") {
        // DD.MM.YYYY
        parts = displayDate.split(".");
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return { iso: "", formatted: displayDate, valid: false };
        }
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      } else {
        // MM/DD/YYYY
        parts = displayDate.split("/");
        if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
          return { iso: "", formatted: displayDate, valid: false };
        }
        month = parseInt(parts[0], 10);
        day = parseInt(parts[1], 10);
        year = parseInt(parts[2], 10);
      }

      // Validate ranges
      if (
        isNaN(day) ||
        isNaN(month) ||
        isNaN(year) ||
        year < 1900 ||
        year > 2100 ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        return { iso: "", formatted: displayDate, valid: false };
      }

      // Check if date is valid (e.g., not 31.02.2025)
      const testDate = new Date(year, month - 1, day);
      if (
        testDate.getDate() !== day ||
        testDate.getMonth() !== month - 1 ||
        testDate.getFullYear() !== year
      ) {
        return { iso: "", formatted: displayDate, valid: false };
      }

      // Format ISO and display
      const dayStr = day.toString().padStart(2, "0");
      const monthStr = month.toString().padStart(2, "0");
      const yearStr = year.toString();
      const iso = `${yearStr}-${monthStr}-${dayStr}`;
      const formatted =
        locale === "de"
          ? `${dayStr}.${monthStr}.${yearStr}`
          : `${monthStr}/${dayStr}/${yearStr}`;

      return { iso, formatted, valid: true };
    } catch {
      return { iso: "", formatted: displayDate, valid: false };
    }
  };

  useEffect(() => {
    async function loadOrganizationalUnits() {
      try {
        const response = await listOrganizationalUnits();
        setOrganizationalUnits(response.data);
      } catch (err) {
        console.error("Failed to load organizational units:", err);
      } finally {
        setUnitsLoading(false);
      }
    }

    loadOrganizationalUnits();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    clearSubmitMessages();

    const {
      errors: validationErrors,
      normalizedData,
      normalizedBirthDateDisplay,
      normalizedContractDateDisplay,
    } = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setSubmitFeedback(
        i18n._(msg`Please correct the highlighted fields before submitting.`)
      );
      focusFirstInvalidField(validationErrors);
      return;
    }

    try {
      setLoading(true);
      setFieldErrors({});
      setBirthDateDisplay(normalizedBirthDateDisplay);
      setContractDateDisplay(normalizedContractDateDisplay);
      setFormData(normalizedData);
      const employee = await createEmployee(normalizedData);
      navigate(`/employees/${employee.id}`);
    } catch (err) {
      console.error("Failed to create employee:", err);
      let errorMessage = "Failed to create employee";

      if (err instanceof ApiError && err.isValidationError() && err.errors) {
        const apiFieldErrors = parseApiValidationErrors(err.errors);
        if (Object.keys(apiFieldErrors).length > 0) {
          setFieldErrors(apiFieldErrors);
          setSubmitFeedback(
            i18n._(
              msg`We couldn't submit the form yet. Please review the highlighted fields.`
            )
          );
          focusFirstInvalidField(apiFieldErrors);
          return;
        }
        errorMessage = err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        errorMessage = String(err.message);
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    field: keyof EmployeeFormData,
    value: string | number | boolean | null
  ) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
    clearSubmitMessages();
  }

  function handleStatusChange(status: EmployeeStatus) {
    setFormData((prev) => ({
      ...prev,
      status,
      ...(status !== "pre_contract" && { send_invitation: false }),
    }));
    clearFieldError("status");
    clearFieldError("send_invitation");
    clearSubmitMessages();
  }

  return (
    <div>
      <div className="mb-6">
        <Button plain onClick={() => navigate("/employees")}>
          <Trans>← Back to Employees</Trans>
        </Button>
      </div>

      <div className="rounded-lg bg-white shadow-sm ring-1 ring-zinc-950/5 p-6 dark:bg-zinc-900 dark:ring-white/10">
        <Heading className="mb-6">
          <Trans>Create New Employee</Trans>
        </Heading>

        <form onSubmit={handleSubmit} className="space-y-8" noValidate>
          {submitFeedback && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
              role="alert"
              aria-live="assertive"
            >
              <Text className="text-red-800 dark:text-red-200">
                {submitFeedback}
              </Text>
            </div>
          )}

          {/* Personal Information */}
          <Fieldset>
            <Legend>
              <Trans>Personal Information</Trans>
            </Legend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="first_name">
                    <Trans>First Name</Trans> *
                  </Label>
                  <Input
                    id="first_name"
                    ref={(element) => setFieldRef("first_name", element)}
                    type="text"
                    name="first_name"
                    required
                    aria-invalid={fieldErrors.first_name ? true : undefined}
                    aria-describedby={getAriaDescribedBy("first_name")}
                    data-invalid={fieldErrors.first_name ? true : undefined}
                    value={formData.first_name}
                    onChange={(e) => handleChange("first_name", e.target.value)}
                  />
                  {fieldErrors.first_name && (
                    <ErrorMessage id={getFieldErrorId("first_name")}>
                      {fieldErrors.first_name}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="last_name">
                    <Trans>Last Name</Trans> *
                  </Label>
                  <Input
                    id="last_name"
                    ref={(element) => setFieldRef("last_name", element)}
                    type="text"
                    name="last_name"
                    required
                    aria-invalid={fieldErrors.last_name ? true : undefined}
                    aria-describedby={getAriaDescribedBy("last_name")}
                    data-invalid={fieldErrors.last_name ? true : undefined}
                    value={formData.last_name}
                    onChange={(e) => handleChange("last_name", e.target.value)}
                  />
                  {fieldErrors.last_name && (
                    <ErrorMessage id={getFieldErrorId("last_name")}>
                      {fieldErrors.last_name}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="date_of_birth">
                    <Trans>Date of Birth</Trans> *
                  </Label>
                  <Input
                    id="date_of_birth"
                    ref={(element) => setFieldRef("date_of_birth", element)}
                    type="text"
                    name="date_of_birth"
                    required
                    aria-invalid={fieldErrors.date_of_birth ? true : undefined}
                    aria-describedby={getAriaDescribedBy("date_of_birth")}
                    data-invalid={fieldErrors.date_of_birth ? true : undefined}
                    placeholder={
                      i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                    }
                    value={birthDateDisplay}
                    onChange={(e) => {
                      setBirthDateDisplay(e.target.value);
                      clearFieldError("date_of_birth");
                      clearSubmitMessages();
                    }}
                    onBlur={(e) => {
                      const result = parseDateToISO(
                        e.target.value,
                        i18n.locale
                      );
                      if (result.valid) {
                        setBirthDateDisplay(result.formatted);
                        handleChange("date_of_birth", result.iso);
                      } else if (e.target.value) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          date_of_birth:
                            i18n.locale === "de"
                              ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
                              : "Invalid date. Please use format MM/DD/YYYY",
                        }));
                      }
                    }}
                  />
                  {fieldErrors.date_of_birth && (
                    <ErrorMessage id={getFieldErrorId("date_of_birth")}>
                      {fieldErrors.date_of_birth}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="email">
                    <Trans>Email</Trans> *
                  </Label>
                  <Input
                    id="email"
                    ref={(element) => setFieldRef("email", element)}
                    type="email"
                    name="email"
                    required
                    aria-invalid={fieldErrors.email ? true : undefined}
                    aria-describedby={getAriaDescribedBy("email")}
                    data-invalid={fieldErrors.email ? true : undefined}
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                  />
                  {fieldErrors.email && (
                    <ErrorMessage id={getFieldErrorId("email")}>
                      {fieldErrors.email}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="phone">
                    <Trans>Phone</Trans>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          {/* Employment Details */}
          <Fieldset>
            <Legend>
              <Trans>Employment Details</Trans>
            </Legend>
            <FieldGroup>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <Field>
                  <Label htmlFor="position">
                    <Trans>Position</Trans> *
                  </Label>
                  <Input
                    id="position"
                    ref={(element) => setFieldRef("position", element)}
                    type="text"
                    name="position"
                    required
                    aria-invalid={fieldErrors.position ? true : undefined}
                    aria-describedby={getAriaDescribedBy("position")}
                    data-invalid={fieldErrors.position ? true : undefined}
                    value={formData.position}
                    onChange={(e) => handleChange("position", e.target.value)}
                  />
                  {fieldErrors.position && (
                    <ErrorMessage id={getFieldErrorId("position")}>
                      {fieldErrors.position}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="contract_start_date">
                    <Trans>Contract Start Date</Trans> *
                  </Label>
                  <Input
                    id="contract_start_date"
                    ref={(element) =>
                      setFieldRef("contract_start_date", element)
                    }
                    type="text"
                    name="contract_start_date"
                    required
                    aria-invalid={
                      fieldErrors.contract_start_date ? true : undefined
                    }
                    aria-describedby={getAriaDescribedBy("contract_start_date")}
                    data-invalid={
                      fieldErrors.contract_start_date ? true : undefined
                    }
                    placeholder={
                      i18n.locale === "de" ? "TT.MM.JJJJ" : "MM/DD/YYYY"
                    }
                    value={contractDateDisplay}
                    onChange={(e) => {
                      setContractDateDisplay(e.target.value);
                      clearFieldError("contract_start_date");
                      clearSubmitMessages();
                    }}
                    onBlur={(e) => {
                      const result = parseDateToISO(
                        e.target.value,
                        i18n.locale
                      );
                      if (result.valid) {
                        setContractDateDisplay(result.formatted);
                        handleChange("contract_start_date", result.iso);
                      } else if (e.target.value) {
                        setFieldErrors((prev) => ({
                          ...prev,
                          contract_start_date:
                            i18n.locale === "de"
                              ? "Ungültiges Datum. Bitte verwenden Sie das Format TT.MM.JJJJ"
                              : "Invalid date. Please use format MM/DD/YYYY",
                        }));
                      }
                    }}
                  />
                  {fieldErrors.contract_start_date && (
                    <ErrorMessage id={getFieldErrorId("contract_start_date")}>
                      {fieldErrors.contract_start_date}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <Label htmlFor="organizational_unit_id">
                    <Trans>Organizational Unit</Trans> *
                  </Label>
                  <Select
                    id="organizational_unit_id"
                    ref={(element) =>
                      setFieldRef("organizational_unit_id", element)
                    }
                    name="organizational_unit_id"
                    required
                    aria-invalid={
                      fieldErrors.organizational_unit_id ? true : undefined
                    }
                    aria-describedby={getAriaDescribedBy(
                      "organizational_unit_id"
                    )}
                    data-invalid={
                      fieldErrors.organizational_unit_id ? true : undefined
                    }
                    value={formData.organizational_unit_id}
                    onChange={(e) =>
                      handleChange("organizational_unit_id", e.target.value)
                    }
                    disabled={unitsLoading}
                  >
                    <option value="">
                      {unitsLoading
                        ? i18n._(msg`Loading...`)
                        : i18n._(msg`Select organizational unit`)}
                    </option>
                    {organizationalUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </Select>
                  {fieldErrors.organizational_unit_id && (
                    <ErrorMessage
                      id={getFieldErrorId("organizational_unit_id")}
                    >
                      {fieldErrors.organizational_unit_id}
                    </ErrorMessage>
                  )}
                </Field>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="is_leadership">
                      <Trans>Leadership Position</Trans>
                    </Label>
                    <Switch
                      id="is_leadership"
                      name="is_leadership"
                      checked={isLeadership}
                      showIcons
                      onChange={(checked) => {
                        setIsLeadership(checked);
                        clearSubmitMessages();
                        if (!checked) {
                          handleChange("management_level", 0);
                          clearFieldError("management_level");
                        }
                      }}
                    />
                  </div>

                  <Field>
                    <span
                      data-slot="control"
                      className="relative block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm dark:before:hidden after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500"
                    >
                      <div className="relative flex items-center rounded-lg border border-zinc-950/10 bg-transparent dark:border-white/10 dark:bg-white/5">
                        {isLeadership && (
                          <div className="shrink-0 pl-3.5 pr-2 py-2.5 text-base/6 text-gray-500 select-none sm:pl-3 sm:pr-2 sm:py-1.5 sm:text-sm/6 dark:text-gray-400">
                            <Trans>ML</Trans>
                          </div>
                        )}
                        <input
                          id="management_level"
                          type="number"
                          name="management_level"
                          min="1"
                          max="255"
                          placeholder={
                            isLeadership
                              ? "?"
                              : i18n._(msg`No management position`)
                          }
                          disabled={!isLeadership}
                          required={isLeadership}
                          ref={(element) =>
                            setFieldRef("management_level", element)
                          }
                          aria-invalid={
                            fieldErrors.management_level ? true : undefined
                          }
                          aria-describedby={getAriaDescribedBy(
                            "management_level"
                          )}
                          value={
                            isLeadership && formData.management_level > 0
                              ? formData.management_level
                              : ""
                          }
                          onChange={(e) =>
                            handleChange(
                              "management_level",
                              e.target.value ? Number(e.target.value) : 0
                            )
                          }
                          className={`relative block w-full appearance-none rounded-lg py-2.5 pr-3.5 text-base/6 text-zinc-950 placeholder:text-zinc-500 bg-transparent focus:outline-hidden sm:py-1.5 sm:pr-3 sm:text-sm/6 dark:text-white dark:placeholder:text-zinc-500 disabled:opacity-50 border-0 ${isLeadership ? "pl-0" : "pl-3.5 sm:pl-3"}`}
                        />
                      </div>
                    </span>
                    {fieldErrors.management_level && (
                      <ErrorMessage id={getFieldErrorId("management_level")}>
                        {fieldErrors.management_level}
                      </ErrorMessage>
                    )}
                  </Field>
                </div>

                <Field>
                  <Label htmlFor="status">
                    <Trans>Status</Trans> *
                  </Label>
                  <Select
                    id="status"
                    ref={(element) => setFieldRef("status", element)}
                    name="status"
                    required
                    aria-invalid={fieldErrors.status ? true : undefined}
                    aria-describedby={getAriaDescribedBy("status")}
                    data-invalid={fieldErrors.status ? true : undefined}
                    value={formData.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as EmployeeStatus)
                    }
                  >
                    <EmployeeStatusOptions />
                  </Select>
                  {fieldErrors.status && (
                    <ErrorMessage id={getFieldErrorId("status")}>
                      {fieldErrors.status}
                    </ErrorMessage>
                  )}
                  <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <Trans>
                      Applicant / Pre-Contract / Active / On Leave / Terminated
                    </Trans>
                  </Text>
                  <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {inviteSupported ? (
                      <Trans>
                        Pre-Contract is the only status that allows onboarding
                        invitations.
                      </Trans>
                    ) : (
                      <Trans>
                        Invitations are only available for employees in
                        pre-contract status.
                      </Trans>
                    )}
                  </Text>
                </Field>

                <Field>
                  <Label htmlFor="contract_type">
                    <Trans>Contract Type</Trans> *
                  </Label>
                  <Select
                    id="contract_type"
                    ref={(element) => setFieldRef("contract_type", element)}
                    name="contract_type"
                    required
                    aria-invalid={fieldErrors.contract_type ? true : undefined}
                    aria-describedby={getAriaDescribedBy("contract_type")}
                    data-invalid={fieldErrors.contract_type ? true : undefined}
                    value={formData.contract_type}
                    onChange={(e) =>
                      handleChange("contract_type", e.target.value)
                    }
                  >
                    <option value="full_time">{i18n._(msg`Full Time`)}</option>
                    <option value="part_time">{i18n._(msg`Part Time`)}</option>
                    <option value="minijob">{i18n._(msg`Minijob`)}</option>
                    <option value="freelance">{i18n._(msg`Freelance`)}</option>
                  </Select>
                  {fieldErrors.contract_type && (
                    <ErrorMessage id={getFieldErrorId("contract_type")}>
                      {fieldErrors.contract_type}
                    </ErrorMessage>
                  )}
                </Field>

                <Field>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-zinc-950/10 px-4 py-3 dark:border-white/10">
                    <div className="space-y-1">
                      <Label htmlFor="send_invitation">
                        <Trans>Send Onboarding Invitation</Trans>
                      </Label>
                      <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                        {inviteSupported ? (
                          <Trans>
                            The new employee will receive an onboarding email
                            immediately after creation.
                          </Trans>
                        ) : (
                          <Trans>
                            Invitations are only available for employees in
                            pre-contract status.
                          </Trans>
                        )}
                      </Text>
                    </div>
                    <Switch
                      id="send_invitation"
                      name="send_invitation"
                      aria-invalid={
                        fieldErrors.send_invitation ? true : undefined
                      }
                      aria-describedby={getAriaDescribedBy("send_invitation")}
                      checked={
                        Boolean(formData.send_invitation) && inviteSupported
                      }
                      disabled={!inviteSupported}
                      onChange={(checked) =>
                        handleChange(
                          "send_invitation",
                          inviteSupported ? checked : false
                        )
                      }
                    />
                  </div>
                  {fieldErrors.send_invitation && (
                    <ErrorMessage id={getFieldErrorId("send_invitation")}>
                      {fieldErrors.send_invitation}
                    </ErrorMessage>
                  )}
                </Field>
              </div>
            </FieldGroup>
          </Fieldset>

          {error && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20"
              role="alert"
              aria-live="assertive"
            >
              <Text className="text-red-800 dark:text-red-400">{error}</Text>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              outline
              onClick={() => navigate("/employees")}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Trans>Creating...</Trans>
              ) : (
                <Trans>Create Employee</Trans>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmployeeCreate;
