// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import type { EmployeeFormData, EmployeeStatus } from "@/types/api";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Switch } from "@/ui/switch";
import { createEmployee } from "../../services/employeeApi";
import { ApiError } from "../../services/ApiError";
import { DomainAssignmentFields } from "../../components/DomainAssignmentFields";
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  EmployeeFieldset as Fieldset,
  EmployeeLegend as Legend,
  EmployeePageText as PageText,
  EmployeePageTitle as PageTitle,
} from "@/ui";
import { EmployeeStatusSelectItems } from "./EmployeeStatusOptions";
import { EmployeeAddressFields } from "./EmployeeAddressFields";
import {
  buildCreateAddressPayload,
  emptyPostalAddressDraft,
} from "./employeeAddressDraft";
import type { PostalAddressDraft } from "../../lib/employeeAddresses";
import {
  GERMAN_CONTRACT_START_DATE_ERROR,
  GERMAN_CONTRACT_START_DATE_HINT,
  parseEmployeeDateToISO,
} from "./employeeDateUtils";
import { EmployeeManagementLevelField } from "./EmployeeManagementLevelField";

type EmployeeFormField = keyof EmployeeFormData;
type EmployeeFormErrors = Partial<Record<EmployeeFormField, string>>;

const fieldOrder: EmployeeFormField[] = [
  "first_name",
  "last_name",
  "email",
  "date_of_birth",
  "position",
  "contract_start_date",
  "legal_entity_id",
  "establishment_id",
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
  const [isLeadership, setIsLeadership] = useState(false);
  const [addressDraft, setAddressDraft] = useState<PostalAddressDraft>(
    emptyPostalAddressDraft
  );
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
    legal_entity_id: "",
    establishment_id: "",
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

    const invalidField = fieldRefs.current[firstInvalidField];
    invalidField?.focus();
    window.setTimeout(() => invalidField?.focus(), 0);
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
      legal_entity_id: formData.legal_entity_id.trim(),
      establishment_id: formData.establishment_id.trim(),
      management_level: isLeadership ? formData.management_level : 0,
      send_invitation:
        formData.status === "pre_contract"
          ? Boolean(formData.send_invitation)
          : false,
    };
    const addressPayload = buildCreateAddressPayload(addressDraft);
    if (addressPayload) {
      normalizedData.addresses = addressPayload;
    } else {
      delete normalizedData.addresses;
    }
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
      const birthDate = parseEmployeeDateToISO(
        normalizedBirthDateDisplay,
        i18n.locale,
        { allowIsoInput: true }
      );
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
      const contractDate = parseEmployeeDateToISO(
        normalizedContractDateDisplay,
        i18n.locale,
        {
          allowIsoInput: true,
          defaultCurrentYearForMissingYear: i18n.locale === "de",
        }
      );
      if (!contractDate.valid) {
        errors.contract_start_date =
          i18n.locale === "de"
            ? GERMAN_CONTRACT_START_DATE_ERROR
            : "Invalid date. Please use format MM/DD/YYYY";
      } else {
        normalizedData.contract_start_date = contractDate.iso;
        normalizedContractDateDisplay = contractDate.formatted;
      }
    }

    if (!normalizedData.legal_entity_id)
      errors.legal_entity_id = i18n._(msg`Legal entity is required`);
    if (!normalizedData.establishment_id)
      errors.establishment_id = i18n._(msg`Establishment is required`);

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

  function handleAddressChange(field: keyof PostalAddressDraft, value: string) {
    setAddressDraft((prev) => ({ ...prev, [field]: value }));
    clearSubmitMessages();
  }

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate("/employees")}>
          <Trans>← Back to Employees</Trans>
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <PageTitle className="mb-6">
            <Trans>Create New Employee</Trans>
          </PageTitle>

          <form onSubmit={handleSubmit} className="space-y-8" noValidate>
            {submitFeedback && (
              <Alert
                className="border-destructive/30 bg-destructive/10 text-destructive"
                aria-live="assertive"
              >
                <AlertDescription className="text-destructive">
                  {submitFeedback}
                </AlertDescription>
              </Alert>
            )}

            {/* Personal Information */}
            <Fieldset>
              <Legend>
                <Trans>Personal Information</Trans>
              </Legend>
              <FieldGroup>
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="first_name">
                      <Trans>First Name</Trans> *
                    </FieldLabel>
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
                      onChange={(e) =>
                        handleChange("first_name", e.target.value)
                      }
                    />
                    {fieldErrors.first_name && (
                      <FieldError id={getFieldErrorId("first_name")}>
                        {fieldErrors.first_name}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="last_name">
                      <Trans>Last Name</Trans> *
                    </FieldLabel>
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
                      onChange={(e) =>
                        handleChange("last_name", e.target.value)
                      }
                    />
                    {fieldErrors.last_name && (
                      <FieldError id={getFieldErrorId("last_name")}>
                        {fieldErrors.last_name}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="date_of_birth">
                      <Trans>Date of Birth</Trans> *
                    </FieldLabel>
                    <Input
                      id="date_of_birth"
                      ref={(element) => setFieldRef("date_of_birth", element)}
                      type="text"
                      name="date_of_birth"
                      required
                      aria-invalid={
                        fieldErrors.date_of_birth ? true : undefined
                      }
                      aria-describedby={getAriaDescribedBy("date_of_birth")}
                      data-invalid={
                        fieldErrors.date_of_birth ? true : undefined
                      }
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
                        const result = parseEmployeeDateToISO(
                          e.target.value,
                          i18n.locale,
                          { allowIsoInput: true }
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
                      <FieldError id={getFieldErrorId("date_of_birth")}>
                        {fieldErrors.date_of_birth}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="email">
                      <Trans>Email</Trans> *
                    </FieldLabel>
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
                      <FieldError id={getFieldErrorId("email")}>
                        {fieldErrors.email}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="phone">
                      <Trans>Phone</Trans>
                    </FieldLabel>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <PageText className="text-foreground text-sm font-semibold">
                      <Trans>Current Address</Trans>
                    </PageText>
                  </div>

                  <EmployeeAddressFields
                    draft={addressDraft}
                    onChange={handleAddressChange}
                  />
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
                    <FieldLabel htmlFor="position">
                      <Trans>Position</Trans> *
                    </FieldLabel>
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
                      <FieldError id={getFieldErrorId("position")}>
                        {fieldErrors.position}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="contract_start_date">
                      <Trans>Contract Start Date</Trans> *
                    </FieldLabel>
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
                      aria-describedby={getAriaDescribedBy(
                        "contract_start_date"
                      )}
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
                        const result = parseEmployeeDateToISO(
                          e.target.value,
                          i18n.locale,
                          {
                            allowIsoInput: true,
                            defaultCurrentYearForMissingYear:
                              i18n.locale === "de",
                          }
                        );
                        if (result.valid) {
                          setContractDateDisplay(result.formatted);
                          handleChange("contract_start_date", result.iso);
                        } else if (e.target.value) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            contract_start_date:
                              i18n.locale === "de"
                                ? GERMAN_CONTRACT_START_DATE_ERROR
                                : "Invalid date. Please use format MM/DD/YYYY",
                          }));
                        }
                      }}
                    />
                    {i18n.locale === "de" && (
                      <FieldDescription>
                        {GERMAN_CONTRACT_START_DATE_HINT}
                      </FieldDescription>
                    )}
                    {fieldErrors.contract_start_date && (
                      <FieldError id={getFieldErrorId("contract_start_date")}>
                        {fieldErrors.contract_start_date}
                      </FieldError>
                    )}
                  </Field>

                  <DomainAssignmentFields
                    idPrefix="employee"
                    value={formData}
                    triggerRefs={{
                      legal_entity_id: (element) =>
                        setFieldRef("legal_entity_id", element),
                      establishment_id: (element) =>
                        setFieldRef("establishment_id", element),
                    }}
                    onChange={(assignment) =>
                      setFormData((current) => ({ ...current, ...assignment }))
                    }
                    errors={fieldErrors}
                    onClearErrors={(fields) =>
                      setFieldErrors((current) => {
                        const next = { ...current };
                        for (const field of fields) {
                          if (field !== "customer_id") delete next[field];
                        }
                        return next;
                      })
                    }
                  />

                  <EmployeeManagementLevelField
                    checked={isLeadership}
                    describedBy={getAriaDescribedBy("management_level")}
                    error={fieldErrors.management_level}
                    inputRef={(element) =>
                      setFieldRef("management_level", element)
                    }
                    noManagementPlaceholder={i18n._(
                      msg`No management position`
                    )}
                    onCheckedChange={(checked) => {
                      setIsLeadership(checked);
                      clearSubmitMessages();
                      if (!checked) {
                        handleChange("management_level", 0);
                        clearFieldError("management_level");
                      }
                    }}
                    onValueChange={(value) =>
                      handleChange("management_level", value)
                    }
                    value={formData.management_level}
                  />

                  <Field>
                    <FieldLabel htmlFor="status">
                      <Trans>Status</Trans> *
                    </FieldLabel>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        handleStatusChange(value as EmployeeStatus)
                      }
                    >
                      <SelectTrigger
                        id="status"
                        ref={(element) => setFieldRef("status", element)}
                        aria-invalid={fieldErrors.status ? true : undefined}
                        aria-describedby={getAriaDescribedBy("status")}
                        data-invalid={fieldErrors.status ? true : undefined}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <EmployeeStatusSelectItems />
                      </SelectContent>
                    </Select>
                    {fieldErrors.status && (
                      <FieldError id={getFieldErrorId("status")}>
                        {fieldErrors.status}
                      </FieldError>
                    )}
                    <FieldDescription>
                      <Trans>
                        Applicant / Pre-Contract / Active / On Leave /
                        Terminated
                      </Trans>
                    </FieldDescription>
                    <FieldDescription>
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
                    </FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="contract_type">
                      <Trans>Contract Type</Trans> *
                    </FieldLabel>
                    <Select
                      value={formData.contract_type}
                      onValueChange={(value) =>
                        handleChange("contract_type", value)
                      }
                    >
                      <SelectTrigger
                        id="contract_type"
                        ref={(element) => setFieldRef("contract_type", element)}
                        aria-invalid={
                          fieldErrors.contract_type ? true : undefined
                        }
                        aria-describedby={getAriaDescribedBy("contract_type")}
                        data-invalid={
                          fieldErrors.contract_type ? true : undefined
                        }
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time" data-value="full_time">
                          {i18n._(msg`Full Time`)}
                        </SelectItem>
                        <SelectItem value="part_time" data-value="part_time">
                          {i18n._(msg`Part Time`)}
                        </SelectItem>
                        <SelectItem value="minijob" data-value="minijob">
                          {i18n._(msg`Minijob`)}
                        </SelectItem>
                        <SelectItem value="freelance" data-value="freelance">
                          {i18n._(msg`Freelance`)}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {fieldErrors.contract_type && (
                      <FieldError id={getFieldErrorId("contract_type")}>
                        {fieldErrors.contract_type}
                      </FieldError>
                    )}
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                      <div className="space-y-1">
                        <FieldLabel htmlFor="send_invitation">
                          <Trans>Send Onboarding Invitation</Trans>
                        </FieldLabel>
                        <PageText>
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
                        </PageText>
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
                      <FieldError id={getFieldErrorId("send_invitation")}>
                        {fieldErrors.send_invitation}
                      </FieldError>
                    )}
                  </Field>
                </div>
              </FieldGroup>
            </Fieldset>

            {error && (
              <Alert
                className="border-destructive/30 bg-destructive/10 text-destructive"
                aria-live="assertive"
              >
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
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
        </CardContent>
      </Card>
    </div>
  );
}

export default EmployeeCreate;
