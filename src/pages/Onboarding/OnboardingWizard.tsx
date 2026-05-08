// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useMemo, useRef, useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createOnboardingSubmission,
  fetchOnboardingNationalityOptions,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  type OnboardingNationalityOption,
  type OnboardingFormTemplate,
  type OnboardingStep,
  type OnboardingSubmission,
  uploadOnboardingFile,
  updateOnboardingSubmission,
} from "../../services/onboardingApi";
import { ApiError } from "../../services/ApiError";
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from "../../components/checkbox";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Combobox, ComboboxOption } from "../../components/combobox";
import {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Text } from "../../components/text";
import { Textarea } from "../../components/textarea";
import { getLocalizedErrorMessage } from "../../lib/errorUtils";
import {
  getOnboardingStepState,
  isOnboardingAwaitingHrReview,
} from "./onboardingWizardState";

interface OnboardingSchemaArrayItems {
  enum?: Array<string | number>;
  enumNames?: string[];
  pattern?: string;
  type?: "string" | "integer" | "number";
}

interface OnboardingSchemaProperty {
  description?: string;
  enum?: Array<string | number>;
  enumNames?: string[];
  items?: OnboardingSchemaArrayItems;
  maxLength?: number;
  minimum?: number;
  pattern?: string;
  title?: string;
  type: "string" | "integer" | "number" | "boolean" | "array";
}

interface OnboardingObjectSchema {
  properties: Record<string, OnboardingSchemaProperty>;
  required: string[];
}

interface WizardFeedback {
  tone: "success" | "error";
  message: string;
}

interface OnboardingRouteState {
  onboardingRequired?: boolean;
  message?: string;
}

function getPersistentOnboardingRouteState(
  routeState: OnboardingRouteState | null
): OnboardingRouteState | null {
  if (!routeState) {
    return null;
  }

  if (routeState.onboardingRequired === true) {
    return { onboardingRequired: true };
  }

  if (typeof routeState.message === "string") {
    const trimmedMessage = routeState.message.trim();
    if (trimmedMessage.length > 0) {
      return { message: trimmedMessage };
    }
  }

  return null;
}

function getEntryFeedbackFromRouteState(
  routeState: OnboardingRouteState | null,
  translate: ReturnType<typeof useLingui>["_"]
): WizardFeedback | null {
  if (!routeState) {
    return null;
  }

  if (routeState.onboardingRequired === true) {
    return {
      tone: "error",
      message: translate(
        msg`You signed in successfully, but your onboarding is not complete yet. Please complete onboarding to continue using SecPal.`
      ),
    };
  }

  if (typeof routeState.message === "string") {
    const trimmedMessage = routeState.message.trim();
    if (trimmedMessage.length > 0) {
      return {
        tone: "success",
        message: trimmedMessage,
      };
    }
  }

  return null;
}

type FieldErrors = Record<string, string>;
type OnboardingDocumentType = "contract" | "id_document" | "banking_details";

interface UploadedOnboardingFile {
  id: string;
  filename: string;
  documentType: OnboardingDocumentType;
}

const ONBOARDING_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png";
const EMPLOYEE_ONBOARDING_HR_MANAGED_FIELDS = new Set(["intended_activities"]);
const FIRST_EMERGENCY_CONTACT_FIELD_PREFIX = "contact_1_";
const SECOND_EMERGENCY_CONTACT_FIELD_PREFIX = "contact_2_";
const EMERGENCY_CONTACT_NAME_FIELDS = ["contact_1_name", "contact_2_name"];
const SINGLE_VALUE_ARRAY_FIELDS = new Set(["nationalities"]);
const RESIDENCE_TITLE_TYPE_FIELD = "residence_permit_title";
const RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD =
  "residence_permit_employment_allowed";
const RESIDENCE_TITLE_UNLIMITED_FIELD = "residence_permit_unlimited";
const RESIDENCE_TITLE_EXPIRY_FIELD = "residence_permit_expiry";
const RESIDENCE_TITLE_OPTIONS = [
  { value: "Aufenthaltserlaubnis", isUnlimited: false },
  { value: "Blaue Karte EU", isUnlimited: false },
  { value: "ICT-Karte", isUnlimited: false },
  { value: "Mobile-ICT-Karte", isUnlimited: false },
  { value: "Niederlassungserlaubnis", isUnlimited: true },
  { value: "Erlaubnis zum Daueraufenthalt-EU", isUnlimited: true },
  { value: "Chancenkarte", isUnlimited: false },
  { value: "Aufenthaltsgestattung", isUnlimited: false },
  { value: "Duldung", isUnlimited: false },
  { value: "Visum", isUnlimited: false },
] as const;
const RESIDENCE_TITLE_EXEMPT_COUNTRY_CODES = new Set([
  "AT",
  "BE",
  "BG",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IS",
  "IT",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
]);

function isEmployeeEditableOnboardingField(fieldName: string): boolean {
  return !EMPLOYEE_ONBOARDING_HR_MANAGED_FIELDS.has(fieldName);
}

function isMeaningfulOnboardingValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value != null;
}

function hasFirstEmergencyContactDetails(
  formData: Record<string, unknown>
): boolean {
  return Object.entries(formData).some(
    ([fieldName, value]) =>
      fieldName.startsWith(FIRST_EMERGENCY_CONTACT_FIELD_PREFIX) &&
      isMeaningfulOnboardingValue(value)
  );
}

function isSecondEmergencyContactField(fieldName: string): boolean {
  return fieldName.startsWith(SECOND_EMERGENCY_CONTACT_FIELD_PREFIX);
}

function getEmergencyContactPhoneField(fieldName: string): string | null {
  const match = /^contact_(\d+)_name$/.exec(fieldName);
  return match ? `contact_${match[1]}_phone` : null;
}

function isConditionallyRequiredOnboardingField(
  fieldName: string,
  formData: Record<string, unknown>
): boolean {
  return EMERGENCY_CONTACT_NAME_FIELDS.some(
    (nameField) =>
      getEmergencyContactPhoneField(nameField) === fieldName &&
      isMeaningfulOnboardingValue(formData[nameField])
  );
}

function isOnboardingFieldVisible(
  fieldName: string,
  formData: Record<string, unknown>
): boolean {
  if (
    fieldName === RESIDENCE_TITLE_TYPE_FIELD ||
    fieldName === RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD ||
    fieldName === RESIDENCE_TITLE_UNLIMITED_FIELD
  ) {
    return requiresResidenceTitleQuestion(formData.nationalities);
  }

  if (fieldName === RESIDENCE_TITLE_EXPIRY_FIELD) {
    const selectedResidenceTitle = getTextValue(
      formData[RESIDENCE_TITLE_TYPE_FIELD]
    ).trim();
    return (
      requiresResidenceTitleQuestion(formData.nationalities) &&
      selectedResidenceTitle.length > 0 &&
      !isResidenceTitleUnlimited(selectedResidenceTitle)
    );
  }

  if (!isEmployeeEditableOnboardingField(fieldName)) {
    return false;
  }

  return (
    !isSecondEmergencyContactField(fieldName) ||
    hasFirstEmergencyContactDetails(formData)
  );
}

function sanitizeEmployeeOnboardingFormData(
  formData: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(formData)
      .filter(([fieldName]) => isOnboardingFieldVisible(fieldName, formData))
      .map(([fieldName, value]) =>
        SINGLE_VALUE_ARRAY_FIELDS.has(fieldName)
          ? [fieldName, getSingleValueArray(value)]
          : [fieldName, value]
      )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getObjectSchema(
  formSchema: Record<string, unknown>
): OnboardingObjectSchema | null {
  if (formSchema.type !== "object" || !isRecord(formSchema.properties)) {
    return null;
  }

  const properties = formSchema.properties as Record<
    string,
    OnboardingSchemaProperty
  >;

  return {
    properties: Object.fromEntries(
      Object.entries(properties).filter(([fieldName]) =>
        isEmployeeEditableOnboardingField(fieldName)
      )
    ),
    required: Array.isArray(formSchema.required)
      ? formSchema.required.filter(
          (entry): entry is string =>
            typeof entry === "string" &&
            isEmployeeEditableOnboardingField(entry)
        )
      : [],
  };
}

function getArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string | number =>
            typeof entry === "string" || typeof entry === "number"
        )
        .map(String)
    : [];
}

function getSingleValueArray(value: unknown): string[] {
  const arrayValue = getArrayValue(value);
  return arrayValue.length > 0 ? [arrayValue[0] ?? ""] : [];
}

function getPrimaryNationalityCode(nationalitiesValue: unknown): string | null {
  const primaryNationality = getSingleValueArray(nationalitiesValue)[0];
  if (!primaryNationality) {
    return null;
  }

  const normalizedCode = primaryNationality.trim().toUpperCase();
  return normalizedCode.length > 0 ? normalizedCode : null;
}

function requiresResidenceTitleQuestion(nationalitiesValue: unknown): boolean {
  const primaryNationalityCode = getPrimaryNationalityCode(nationalitiesValue);
  if (!primaryNationalityCode) {
    return false;
  }

  return !RESIDENCE_TITLE_EXEMPT_COUNTRY_CODES.has(primaryNationalityCode);
}

function getStepUploadDocumentType(
  schema: OnboardingObjectSchema | null,
  nationalitiesValue: unknown
): OnboardingDocumentType | null {
  if (!schema || !("nationalities" in schema.properties)) {
    return null;
  }

  if (requiresResidenceTitleQuestion(nationalitiesValue)) {
    return "id_document";
  }

  return null;
}

function validateAdditionalRequiredFields(
  schema: OnboardingObjectSchema | null,
  formData: Record<string, unknown>,
  requiredFieldMessage: string,
  expiredResidenceTitleMessage: string,
  employmentNotPermittedMessage: string
): FieldErrors {
  if (!schema || !("nationalities" in schema.properties)) {
    return {};
  }

  if (!requiresResidenceTitleQuestion(formData.nationalities)) {
    return {};
  }

  const errors: FieldErrors = {};
  const selectedResidenceTitle = getTextValue(
    formData[RESIDENCE_TITLE_TYPE_FIELD]
  ).trim();
  const employmentAllowed = getTextValue(
    formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
  )
    .trim()
    .toLowerCase();

  if (selectedResidenceTitle.length === 0) {
    errors[RESIDENCE_TITLE_TYPE_FIELD] = requiredFieldMessage;
  }
  if (employmentAllowed.length === 0) {
    errors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] = requiredFieldMessage;
  } else if (employmentAllowed === "no") {
    errors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] =
      employmentNotPermittedMessage;
  }

  if (
    selectedResidenceTitle.length > 0 &&
    !isResidenceTitleUnlimited(selectedResidenceTitle)
  ) {
    const residenceTitleExpiry = getTextValue(
      formData[RESIDENCE_TITLE_EXPIRY_FIELD]
    ).trim();
    if (residenceTitleExpiry.length === 0) {
      errors[RESIDENCE_TITLE_EXPIRY_FIELD] = requiredFieldMessage;
    } else if (
      /^\d{4}-\d{2}-\d{2}$/.test(residenceTitleExpiry) &&
      residenceTitleExpiry < getLocalTodayIsoDate()
    ) {
      errors[RESIDENCE_TITLE_EXPIRY_FIELD] = expiredResidenceTitleMessage;
    }
  }

  return errors;
}

function getTextValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : "";
}

function getNumberValue(value: unknown): string {
  return typeof value === "number"
    ? String(value)
    : typeof value === "string"
      ? value
      : "";
}

function getBooleanValue(value: unknown): boolean {
  return value === true;
}

function getSchemaOptions(
  property:
    | Pick<OnboardingSchemaProperty, "enum" | "enumNames">
    | OnboardingSchemaArrayItems
) {
  return (property.enum ?? []).map((value, index) => ({
    value,
    label:
      property.enumNames?.[index] ??
      (typeof value === "string" || typeof value === "number"
        ? String(value)
        : ""),
  }));
}

function getLocalTodayIsoDate(): string {
  const today = new Date();
  const year = String(today.getFullYear());
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isResidenceTitleUnlimited(titleValue: string): boolean {
  const normalizedTitle = titleValue.trim();
  if (normalizedTitle.length === 0) {
    return false;
  }

  return (
    RESIDENCE_TITLE_OPTIONS.find((option) => option.value === normalizedTitle)
      ?.isUnlimited ?? false
  );
}

function getArrayTextareaValue(value: unknown): string {
  return getArrayValue(value).join("\n");
}

function parseArrayTextareaValue(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isRequiredFieldFilled(
  property: OnboardingSchemaProperty,
  value: unknown
): boolean {
  if (property.type === "string") {
    return getTextValue(value).trim().length > 0;
  }

  if (property.type === "integer" || property.type === "number") {
    const raw = getNumberValue(value).trim();
    return raw.length > 0 && Number.isFinite(Number(raw));
  }

  if (property.type === "boolean") {
    return getBooleanValue(value);
  }

  if (property.type === "array") {
    return getArrayValue(value).length > 0;
  }

  return false;
}

function validateRequiredFields(
  schema: OnboardingObjectSchema,
  formData: Record<string, unknown>,
  requiredFieldMessage: string
): FieldErrors {
  const requiredFields = new Set([
    ...schema.required,
    ...Object.keys(schema.properties).filter((fieldName) =>
      isConditionallyRequiredOnboardingField(fieldName, formData)
    ),
  ]);

  return Array.from(requiredFields).reduce<FieldErrors>((errors, fieldName) => {
    const property = schema.properties[fieldName];

    if (!isOnboardingFieldVisible(fieldName, formData)) {
      return errors;
    }

    if (!property || !isRequiredFieldFilled(property, formData[fieldName])) {
      errors[fieldName] = requiredFieldMessage;
    }

    return errors;
  }, {});
}

function matchesSchemaPattern(value: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    // Ignore malformed backend patterns and avoid blocking form progress.
    return true;
  }
}

function getFieldPatternValidationError(
  fieldName: string,
  property: OnboardingSchemaProperty,
  formData: Record<string, unknown>,
  schema: OnboardingObjectSchema,
  translate: ReturnType<typeof useLingui>["_"]
): string | null {
  if (property.type === "string" && property.pattern) {
    const value = getTextValue(formData[fieldName]).trim();
    if (value.length === 0 || matchesSchemaPattern(value, property.pattern)) {
      return null;
    }

    return formatServerValidationMessage(
      fieldName,
      `pattern: ${property.pattern}`,
      schema,
      translate
    );
  }

  if (property.type === "array" && property.items?.pattern) {
    const itemPattern = property.items.pattern;
    const values = getArrayValue(formData[fieldName]);
    if (
      values.length === 0 ||
      values.every((value) => matchesSchemaPattern(value, itemPattern))
    ) {
      return null;
    }

    return formatServerValidationMessage(
      fieldName,
      `pattern: ${itemPattern}`,
      schema,
      translate
    );
  }

  return null;
}

function validatePatternFields(
  schema: OnboardingObjectSchema,
  formData: Record<string, unknown>,
  requiredFieldErrors: FieldErrors,
  translate: ReturnType<typeof useLingui>["_"]
): FieldErrors {
  return Object.entries(schema.properties).reduce<FieldErrors>(
    (errors, [fieldName, property]) => {
      if (!isOnboardingFieldVisible(fieldName, formData)) {
        return errors;
      }

      if (requiredFieldErrors[fieldName]) {
        return errors;
      }

      const patternError = getFieldPatternValidationError(
        fieldName,
        property,
        formData,
        schema,
        translate
      );
      if (patternError) {
        errors[fieldName] = patternError;
      }

      return errors;
    },
    {}
  );
}

function getServerValidationFieldKey(
  key: string,
  schema: OnboardingObjectSchema | null
): string {
  const fieldKey = key.startsWith("form_data.")
    ? key.slice("form_data.".length)
    : key;
  const directKey = schema?.properties[fieldKey] ? fieldKey : null;

  if (directKey) {
    return directKey;
  }

  const [rootKey] = fieldKey.split(".");
  return rootKey && schema?.properties[rootKey] ? rootKey : fieldKey;
}

function getSchemaFieldLabel(
  fieldKey: string,
  schema: OnboardingObjectSchema | null
): string {
  return schema?.properties[fieldKey]?.title ?? fieldKey;
}

function findSchemaFieldKeyForPattern(
  pattern: string,
  schema: OnboardingObjectSchema | null
): string | null {
  if (!schema) {
    return null;
  }

  const matchingEntry = Object.entries(schema.properties).find(
    ([, property]) =>
      property.pattern === pattern || property.items?.pattern === pattern
  );
  if (matchingEntry) {
    return matchingEntry[0];
  }

  if (pattern === "^[A-Z]{2}$") {
    const countryEntry = Object.keys(schema.properties).find((fieldName) =>
      /country|nationalit/i.test(fieldName)
    );
    return countryEntry ?? null;
  }

  return null;
}

function getPatternValidationMessage(
  fieldKey: string,
  message: string,
  schema: OnboardingObjectSchema | null,
  translate: ReturnType<typeof useLingui>["_"]
): string | null {
  // Only trigger on messages that mention "pattern" (case-insensitive).
  if (!/pattern/i.test(message)) {
    return null;
  }

  // Try to extract an actual pattern value from "pattern: <value>" form.
  const patternMatch = /pattern:\s*(.+)$/i.exec(message);
  const pattern = patternMatch?.[1]?.trim();
  // Reject captures that are only punctuation (e.g., trailing "." from
  // "…does not match the required pattern.").
  const actualPattern = pattern && !/^[.,;!?]+$/.test(pattern) ? pattern : null;

  const resolvedFieldKey =
    actualPattern && fieldKey === "form_data"
      ? (findSchemaFieldKeyForPattern(actualPattern, schema) ?? fieldKey)
      : fieldKey;
  const label =
    resolvedFieldKey === "form_data"
      ? translate(msg`This field`)
      : getSchemaFieldLabel(resolvedFieldKey, schema);

  if (actualPattern === "^[A-Z]{2}$") {
    return `${label}: ${translate(
      msg`Use a two-letter country code in uppercase, for example DE.`
    )}`;
  }

  return actualPattern
    ? `${label}: ${translate(
        msg`Please use the required format (${actualPattern}).`
      )}`
    : `${label}: ${translate(msg`Please use the required format.`)}`;
}

function formatServerValidationMessage(
  fieldKey: string,
  message: string,
  schema: OnboardingObjectSchema | null,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  const patternMessage = getPatternValidationMessage(
    fieldKey,
    message,
    schema,
    translate
  );
  if (patternMessage) {
    return patternMessage;
  }

  const label = getSchemaFieldLabel(fieldKey, schema);
  return message.startsWith(`${label}:`) ? message : `${label}: ${message}`;
}

function formatSupplementalValidationMessage(
  message: string,
  schema: OnboardingObjectSchema | null,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  return formatServerValidationMessage("form_data", message, schema, translate);
}

function formatValidationFallbackMessage(
  message: string,
  schema: OnboardingObjectSchema | null,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  if (/pattern/i.test(message)) {
    return formatSupplementalValidationMessage(message, schema, translate);
  }

  return message;
}

function isEditableSubmission(
  submission: OnboardingSubmission | null
): boolean {
  return (
    submission === null ||
    submission.status === "draft" ||
    submission.status === "rejected"
  );
}

function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const percentage = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between">
        <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          <Trans>
            Step {currentStep} of {totalSteps}
          </Trans>
        </Text>
        <Text className="text-sm font-medium text-gray-700 dark:text-zinc-300">
          {Math.round(percentage)}%
        </Text>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-zinc-800">
        <div
          className="h-2.5 rounded-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function SchemaFieldRenderer({
  fieldName,
  property,
  required,
  readOnly,
  formData,
  dynamicArrayOptions,
  error,
  onChange,
}: {
  fieldName: string;
  property: OnboardingSchemaProperty;
  required: boolean;
  readOnly: boolean;
  formData: Record<string, unknown>;
  dynamicArrayOptions?: Array<{ value: string; label: string }>;
  error?: string;
  onChange: (fieldName: string, value: unknown) => void;
}) {
  const title = property.title ?? fieldName;
  const { _ } = useLingui();
  const showRequiredMarker = required && !readOnly;
  const fieldRequired = required && !readOnly;

  if (property.type === "string") {
    const options = getSchemaOptions(property);

    return (
      <Field>
        <Label>
          {title}
          {showRequiredMarker ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
        {options.length > 0 ? (
          <Select
            aria-label={title}
            disabled={readOnly}
            invalid={Boolean(error)}
            name={fieldName}
            required={fieldRequired}
            value={getTextValue(formData[fieldName])}
            onChange={(event) => onChange(fieldName, event.target.value)}
          >
            <option value="">{_(msg`Select an option`)}</option>
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            aria-label={title}
            disabled={readOnly}
            invalid={Boolean(error)}
            name={fieldName}
            pattern={property.pattern}
            required={fieldRequired}
            value={getTextValue(formData[fieldName])}
            maxLength={property.maxLength}
            onChange={(event) => onChange(fieldName, event.target.value)}
          />
        )}
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>
    );
  }

  if (property.type === "integer" || property.type === "number") {
    const options = getSchemaOptions(property);

    return (
      <Field>
        <Label>
          {title}
          {showRequiredMarker ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
        {options.length > 0 ? (
          <Select
            aria-label={title}
            disabled={readOnly}
            invalid={Boolean(error)}
            name={fieldName}
            required={fieldRequired}
            value={getNumberValue(formData[fieldName])}
            onChange={(event) =>
              onChange(
                fieldName,
                event.target.value === "" ? "" : Number(event.target.value)
              )
            }
          >
            <option value="">{_(msg`Select an option`)}</option>
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            aria-label={title}
            disabled={readOnly}
            invalid={Boolean(error)}
            type="number"
            name={fieldName}
            required={fieldRequired}
            value={getNumberValue(formData[fieldName])}
            min={property.minimum}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(fieldName, nextValue === "" ? "" : Number(nextValue));
            }}
          />
        )}
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>
    );
  }

  if (property.type === "boolean") {
    return (
      <CheckboxField>
        <Checkbox
          aria-label={title}
          checked={getBooleanValue(formData[fieldName])}
          disabled={readOnly}
          onChange={(checked) => onChange(fieldName, checked)}
        />
        <Label>
          {title}
          {showRequiredMarker ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </CheckboxField>
    );
  }

  if (property.type === "array") {
    const schemaItemOptions = property.items
      ? getSchemaOptions(property.items)
      : [];
    const itemOptions = dynamicArrayOptions ?? schemaItemOptions;
    const selectedValues = getArrayValue(formData[fieldName]);

    if (fieldName === "nationalities" && itemOptions.length === 0) {
      return (
        <Field>
          <Label>
            {title}
            {showRequiredMarker ? " *" : null}
          </Label>
          <Description>
            <Trans>
              Nationality options could not be loaded right now. Please reload
              this page and try again.
            </Trans>
          </Description>
          <Select
            aria-label={title}
            disabled
            invalid={Boolean(error)}
            name={fieldName}
            required={fieldRequired}
            value=""
            onChange={() => {}}
          >
            <option value="">{_(msg`Select an option`)}</option>
          </Select>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </Field>
      );
    }

    if (itemOptions.length > 0) {
      if (fieldName === "nationalities") {
        const nationalityOptions = itemOptions.map((option) => ({
          value: String(option.value),
          label: option.label,
        }));
        const selectedValue = selectedValues[0] ?? "";
        const selectedOption =
          nationalityOptions.find((option) => option.value === selectedValue) ??
          null;

        return (
          <Field>
            <Label>
              {title}
              {showRequiredMarker ? " *" : null}
            </Label>
            <Description>
              {_(msg`Search and select one nationality.`)}
            </Description>
            <Combobox
              aria-label={title}
              disabled={readOnly}
              invalid={Boolean(error)}
              name={fieldName}
              options={nationalityOptions}
              placeholder={_(msg`Select an option`)}
              value={selectedOption}
              displayValue={(option) => option?.label}
              onChange={(option) =>
                onChange(fieldName, option ? [option.value] : [])
              }
            >
              {(option) => (
                <ComboboxOption value={option}>{option.label}</ComboboxOption>
              )}
            </Combobox>
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          </Field>
        );
      }

      return (
        <Field>
          <Label>
            {title}
            {showRequiredMarker ? " *" : null}
          </Label>
          {property.description ? (
            <Description>{property.description}</Description>
          ) : null}
          <CheckboxGroup aria-label={title}>
            {itemOptions.map((option) => {
              const optionValue = String(option.value);

              return (
                <CheckboxField key={optionValue}>
                  <Checkbox
                    aria-label={option.label}
                    checked={selectedValues.includes(optionValue)}
                    disabled={readOnly}
                    onChange={(checked) => {
                      const nextValues = checked
                        ? [...selectedValues, optionValue]
                        : selectedValues.filter(
                            (entry) => entry !== optionValue
                          );

                      onChange(fieldName, nextValues);
                    }}
                  />
                  <Label>{option.label}</Label>
                </CheckboxField>
              );
            })}
          </CheckboxGroup>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
        </Field>
      );
    }

    return (
      <Field>
        <Label>
          {title}
          {showRequiredMarker ? " *" : null}
        </Label>
        <Description>
          {property.description ?? _(msg`Enter one value per line.`)}
        </Description>
        <Textarea
          aria-label={title}
          disabled={readOnly}
          invalid={Boolean(error)}
          name={fieldName}
          required={fieldRequired}
          rows={4}
          value={getArrayTextareaValue(formData[fieldName])}
          onChange={(event) =>
            onChange(fieldName, parseArrayTextareaValue(event.target.value))
          }
        />
        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      </Field>
    );
  }

  return null;
}

function OnboardingStepsOverview({ steps }: { steps: OnboardingStep[] }) {
  const { _ } = useLingui();
  const requiredSteps = steps.filter((step) => step.is_required);
  const optionalSteps = steps.filter((step) => !step.is_required);

  return (
    <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <Heading level={3} className="mb-3">
        <Trans>Before you begin</Trans>
      </Heading>
      <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        <Trans>
          Here is what the onboarding wizard will ask for. Required sections
          must be completed; optional sections can be skipped when empty.
        </Trans>
      </Text>

      {requiredSteps.length > 0 ? (
        <div className="mb-4">
          <Text className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Trans>Required information</Trans>
          </Text>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {requiredSteps.map((step) => (
              <li key={step.template_id}>
                {_(msg`Step ${step.step_number}: ${step.title}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {optionalSteps.length > 0 ? (
        <div className="mb-4">
          <Text className="mb-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Trans>Optional sections</Trans>
          </Text>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {optionalSteps.map((step) => (
              <li key={step.template_id}>
                {_(msg`Step ${step.step_number}: ${step.title}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
        <Text className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Trans>Supporting documents</Trans>
        </Text>
        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
          <Trans>
            On every onboarding step you can upload PDF, JPG, or PNG files up to
            10 MB — choose contract, identity document, or banking verification
            as appropriate.
          </Trans>
        </Text>
      </div>
    </div>
  );
}

function StepNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSaveDraft,
  onSubmit,
  onSkipStep,
  showSkipStep,
  isStepEditable,
  canGoNext,
  isBusy,
}: {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onSkipStep?: () => void;
  showSkipStep?: boolean;
  isStepEditable: boolean;
  canGoNext: boolean;
  isBusy: boolean;
}) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 dark:border-zinc-800">
      <div>
        {!isFirstStep && (
          <Button disabled={isBusy} onClick={onPrevious} outline>
            <Trans>Previous</Trans>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {isStepEditable ? (
          <Button disabled={isBusy} onClick={onSaveDraft} outline>
            <Trans>Save Draft</Trans>
          </Button>
        ) : null}

        {showSkipStep && onSkipStep && !isLastStep && isStepEditable ? (
          <Button disabled={isBusy} onClick={onSkipStep} outline>
            <Trans>Skip this step</Trans>
          </Button>
        ) : null}

        {isLastStep ? (
          isStepEditable ? (
            <Button onClick={onSubmit} disabled={!canGoNext}>
              <Trans>Submit for Review</Trans>
            </Button>
          ) : null
        ) : (
          <Button onClick={onNext} disabled={!canGoNext}>
            <Trans>Next</Trans>
          </Button>
        )}
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  const { _ } = useLingui();
  const translateRef = useRef(_);
  const navigate = useNavigate();
  const location = useLocation();
  const [entryRouteState] = useState<OnboardingRouteState | null>(() =>
    getPersistentOnboardingRouteState(
      location.state as OnboardingRouteState | null
    )
  );
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [template, setTemplate] = useState<OnboardingFormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [submission, setSubmission] = useState<OnboardingSubmission | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<WizardFeedback | null>(null);
  const entryFeedback = useMemo(
    () => getEntryFeedbackFromRouteState(entryRouteState, _),
    [entryRouteState, _]
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [nationalityOptions, setNationalityOptions] = useState<
    OnboardingNationalityOption[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [uploadDocumentType, setUploadDocumentType] =
    useState<OnboardingDocumentType>("contract");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<WizardFeedback | null>(
    null
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedOnboardingFile[]>(
    []
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onboardingErrorRef = useRef<HTMLDivElement | null>(null);
  const currentStepIndexRef = useRef(0);
  const templateCacheRef = useRef<Map<string, OnboardingFormTemplate>>(
    new Map()
  );
  const currentStepTemplateId = steps[currentStepIndex]?.template_id;
  const schema = template ? getObjectSchema(template.form_schema) : null;
  const stepUploadDocumentType = getStepUploadDocumentType(
    schema,
    formData.nationalities
  );
  const isCurrentStepEditable = isEditableSubmission(submission);

  function resetUploadState() {
    setUploading(false);
    setUploadDocumentType("contract");
    setUploadFile(null);
    setUploadFeedback(null);
    setUploadedFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    translateRef.current = _;
  }, [_]);

  useEffect(() => {
    const routeState = location.state as OnboardingRouteState | null;
    if (!routeState) {
      return;
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (feedback?.tone !== "error" && !error) {
      return;
    }

    const errorElement = onboardingErrorRef.current;
    if (!errorElement) {
      return;
    }

    if (typeof errorElement.scrollIntoView === "function") {
      errorElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    errorElement.focus({ preventScroll: true });
  }, [feedback, error, currentStepIndex]);

  useEffect(() => {
    let active = true;

    void fetchOnboardingSteps()
      .then((data) => {
        if (!active) {
          return;
        }

        setError(null);
        setFeedback(null);

        if (isOnboardingAwaitingHrReview(data)) {
          setSteps(data);
          setLoading(false);
          navigate("/onboarding/submitted", { replace: true });
          return;
        }

        setLoading(data.length > 0);
        setSteps(data);

        const stepState = getOnboardingStepState(data[0]);
        setSubmission(stepState.submission);
        setFormData(stepState.formData);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setError(
          getLocalizedErrorMessage(err, translateRef.current, {
            fallback: msg`Failed to load onboarding steps`,
          })
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    let active = true;

    void fetchOnboardingNationalityOptions()
      .then((options) => {
        if (!active) {
          return;
        }

        setNationalityOptions(options);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setNationalityOptions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  // Re-fetch the template only when the user navigates to a different step or
  // when steps first arrive — not on every draft-save that updates steps content.
  useEffect(() => {
    if (!currentStepTemplateId) {
      return;
    }

    const cachedTemplate = templateCacheRef.current.get(currentStepTemplateId);
    if (cachedTemplate) {
      setTemplate(cachedTemplate);
      setLoading(false);
      return;
    }

    let active = true;

    void fetchOnboardingTemplate(currentStepTemplateId)
      .then((templateData) => {
        if (!active) {
          return;
        }

        templateCacheRef.current.set(currentStepTemplateId, templateData);
        setTemplate(templateData);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setError(
          getLocalizedErrorMessage(err, translateRef.current, {
            fallback: msg`Failed to load form template`,
          })
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentStepIndex, currentStepTemplateId]);

  function updateStepAtIndex(
    stepIndex: number,
    savedSubmission: OnboardingSubmission,
    status: "draft" | "submitted"
  ) {
    setSteps((currentSteps) =>
      currentSteps.map((step, index) =>
        index === stepIndex
          ? {
              ...step,
              is_completed: status === "submitted" ? true : step.is_completed,
              submission: savedSubmission,
            }
          : step
      )
    );
  }

  function updateCurrentStep(
    savedSubmission: OnboardingSubmission,
    status: "draft" | "submitted"
  ) {
    updateStepAtIndex(currentStepIndex, savedSubmission, status);
  }

  async function resolveStepValidationSchema(
    step: OnboardingStep | undefined
  ): Promise<OnboardingObjectSchema | null> {
    if (!step) {
      return null;
    }

    if (template && step.template_id === currentStepTemplateId) {
      return getObjectSchema(template.form_schema);
    }

    const cachedTemplate = templateCacheRef.current.get(step.template_id);
    if (cachedTemplate) {
      return getObjectSchema(cachedTemplate.form_schema);
    }

    try {
      const stepTemplate = await fetchOnboardingTemplate(step.template_id);
      templateCacheRef.current.set(step.template_id, stepTemplate);
      return getObjectSchema(stepTemplate.form_schema);
    } catch {
      return null;
    }
  }

  async function submitRequiredDraftSteps(): Promise<boolean> {
    const stepsToSubmit: Array<{
      index: number;
      submission: OnboardingSubmission;
    }> = [];

    for (const [index, step] of steps.entries()) {
      if (!step.is_required || index === currentStepIndex) {
        continue;
      }

      if (step.submission == null) {
        setError(_(msg`Failed to submit`));
        return false;
      }

      if (step.submission.status !== "draft") {
        continue;
      }

      stepsToSubmit.push({
        index,
        submission: step.submission,
      });
    }

    if (stepsToSubmit.length === 0) {
      return true;
    }

    let failingStepIndex: number | null = null;

    try {
      setSaving(true);
      setError(null);

      for (const { index, submission: stepSubmission } of stepsToSubmit) {
        failingStepIndex = index;
        const savedSubmission = await updateOnboardingSubmission(
          stepSubmission.id,
          {
            form_data: sanitizeEmployeeOnboardingFormData(
              (stepSubmission.form_data as Record<string, unknown> | null) ?? {}
            ),
            status: "submitted",
          }
        );

        updateStepAtIndex(index, savedSubmission, "submitted");
        failingStepIndex = null;
      }

      return true;
    } catch (err) {
      let validationSchemaForMessage: OnboardingObjectSchema | null = schema;

      if (failingStepIndex !== null) {
        const failedStep = steps[failingStepIndex];
        const failedStepState = getOnboardingStepState(failedStep);
        const failedStepSchema = await resolveStepValidationSchema(failedStep);
        if (failedStepSchema) {
          validationSchemaForMessage = failedStepSchema;
        }

        setLoading(true);
        setFeedback(null);
        setFieldErrors({});
        resetUploadState();
        setTemplate(null);
        setSubmission(failedStepState.submission);
        setFormData(failedStepState.formData);
        setCurrentStepIndex(failingStepIndex);
      }

      if (err instanceof ApiError && err.statusCode === 422) {
        setError(null);
        setFeedback({
          tone: "error",
          message:
            err.message.length > 0
              ? formatValidationFallbackMessage(
                  err.message,
                  validationSchemaForMessage,
                  _
                )
              : _(msg`Please review the highlighted fields and try again.`),
        });
      } else {
        setError(err instanceof Error ? err.message : _(msg`Failed to submit`));
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function persistCurrentStep(
    status: "draft" | "submitted"
  ): Promise<OnboardingSubmission | null> {
    if (!template) {
      return null;
    }

    try {
      setSaving(true);
      setError(null);
      setFeedback(null);
      setFieldErrors({});

      const nextFormData = sanitizeEmployeeOnboardingFormData(
        Object.keys(formData).length > 0
          ? formData
          : ((submission?.form_data as Record<string, unknown> | null) ?? {})
      );

      const savedSubmission = submission
        ? await updateOnboardingSubmission(submission.id, {
            form_data: nextFormData,
            status,
          })
        : await createOnboardingSubmission({
            form_template_id: template.id,
            form_data: nextFormData,
            status,
          });

      setSubmission(savedSubmission);
      updateCurrentStep(savedSubmission, status);
      return savedSubmission;
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.statusCode === 422 &&
        err.errors &&
        status === "submitted"
      ) {
        const nextFieldErrors: FieldErrors = {};
        let hiddenFieldValidationMessage: string | null = null;
        for (const [key, messages] of Object.entries(err.errors)) {
          if (
            key === "form_data" ||
            key === "onboarding_workflow_status" ||
            key === "status"
          ) {
            continue;
          }
          // API validation keys may be nested, e.g. "form_data.nationalities.0".
          // Map them back to the rendered schema field before showing the error.
          const fieldKey = getServerValidationFieldKey(key, schema);
          const first = messages[0];
          if (!first) {
            continue;
          }

          const isInlineFieldError =
            Boolean(schema?.properties[fieldKey]) &&
            isOnboardingFieldVisible(fieldKey, formData);

          if (!isInlineFieldError) {
            hiddenFieldValidationMessage ??= formatServerValidationMessage(
              fieldKey,
              first,
              schema,
              _
            );
            continue;
          }

          nextFieldErrors[fieldKey] = formatServerValidationMessage(
            fieldKey,
            first,
            schema,
            _
          );
        }
        setError(null);
        setFieldErrors(nextFieldErrors);
        const supplementalRaw =
          err.errors.form_data?.[0] ??
          err.errors.onboarding_workflow_status?.[0];
        const supplemental = supplementalRaw
          ? formatSupplementalValidationMessage(supplementalRaw, schema, _)
          : hiddenFieldValidationMessage;
        const hasInline = Object.keys(nextFieldErrors).length > 0;
        const validationReviewMessage = _(
          msg`We couldn't submit the form yet. Please review the highlighted fields.`
        );
        const fallbackValidationMessage =
          err.message.length > 0
            ? formatValidationFallbackMessage(err.message, schema, _)
            : null;
        setFeedback({
          tone: "error",
          message: hasInline
            ? validationReviewMessage
            : supplemental
              ? supplemental
              : (fallbackValidationMessage ?? validationReviewMessage),
        });
        return null;
      }

      setError(
        getLocalizedErrorMessage(err, _, {
          fallback:
            status === "draft"
              ? msg`Failed to save draft`
              : msg`Failed to submit`,
          validation: msg`Please review the highlighted fields and try again.`,
        })
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (saving || uploading || !isEditableSubmission(submission)) {
      return;
    }

    if (await persistCurrentStep("draft")) {
      setFeedback({
        tone: "success",
        message: _(msg`Draft saved. You can continue later.`),
      });
    }
  }

  function validateCurrentStepRequiredFields(): boolean {
    if (!schema || !template) {
      return true;
    }

    const requiredSchema =
      template.is_required === false ? { ...schema, required: [] } : schema;
    const requiredFieldErrors = validateRequiredFields(
      requiredSchema,
      formData,
      _(msg`This field is required.`)
    );
    const additionalRequiredFieldErrors = validateAdditionalRequiredFields(
      requiredSchema,
      formData,
      _(msg`This field is required.`),
      _(msg`The residence title expiry date cannot be in the past.`),
      _(
        msg`A valid residence title without employment authorization cannot be accepted. Please contact HR.`
      )
    );
    const patternFieldErrors = validatePatternFields(
      requiredSchema,
      formData,
      requiredFieldErrors,
      _
    );
    const nextFieldErrors = {
      ...requiredFieldErrors,
      ...additionalRequiredFieldErrors,
      ...patternFieldErrors,
    };

    if (Object.keys(nextFieldErrors).length === 0) {
      return true;
    }

    setError(null);
    setFieldErrors(nextFieldErrors);
    setFeedback({
      tone: "error",
      message: _(
        msg`We couldn't submit the form yet. Please review the highlighted fields.`
      ),
    });
    return false;
  }

  async function handleNext() {
    if (saving || uploading) {
      return;
    }

    const shouldPersistDraft = isEditableSubmission(submission);

    if (shouldPersistDraft && !validateCurrentStepRequiredFields()) {
      return;
    }

    if (shouldPersistDraft && !(await persistCurrentStep("draft"))) {
      return;
    }

    if (currentStepIndex < steps.length - 1) {
      const nextStep = steps[currentStepIndex + 1];
      const nextStepState = getOnboardingStepState(nextStep);

      setLoading(true);
      setError(null);
      setFeedback(null);
      setFieldErrors({});
      resetUploadState();
      setTemplate(null);
      setSubmission(nextStepState.submission);
      setFormData(nextStepState.formData);
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }

  function handleSkipStep() {
    if (saving || uploading || currentStepIndex >= steps.length - 1) {
      return;
    }

    const nextStep = steps[currentStepIndex + 1];
    const nextStepState = getOnboardingStepState(nextStep);

    setLoading(true);
    setError(null);
    setFeedback(null);
    setFieldErrors({});
    resetUploadState();
    setTemplate(null);
    setSubmission(nextStepState.submission);
    setFormData(nextStepState.formData);
    setCurrentStepIndex(currentStepIndex + 1);
  }

  function handlePrevious() {
    if (saving || uploading) {
      return;
    }

    if (currentStepIndex > 0) {
      const previousStep = steps[currentStepIndex - 1];
      const previousStepState = getOnboardingStepState(previousStep);

      setLoading(true);
      setError(null);
      setFeedback(null);
      setFieldErrors({});
      resetUploadState();
      setTemplate(null);
      setSubmission(previousStepState.submission);
      setFormData(previousStepState.formData);
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }

  async function handleSubmit() {
    if (saving || uploading) {
      return;
    }

    if (!validateCurrentStepRequiredFields()) {
      return;
    }

    if (currentStepIndex >= steps.length - 1) {
      if (!(await submitRequiredDraftSteps())) {
        return;
      }
    }

    if (await persistCurrentStep("submitted")) {
      if (currentStepIndex >= steps.length - 1) {
        navigate("/onboarding/submitted", { replace: true });
        return;
      }

      setFeedback({
        tone: "success",
        message: _(msg`Onboarding submitted. HR will review your information.`),
      });
    }
  }

  function handleFieldChange(fieldName: string, value: unknown) {
    const normalizedValue = SINGLE_VALUE_ARRAY_FIELDS.has(fieldName)
      ? getSingleValueArray(value)
      : value;

    setFormData((currentFormData) => {
      let nextFormData: Record<string, unknown> = {
        ...currentFormData,
        [fieldName]: normalizedValue,
      };

      if (fieldName === RESIDENCE_TITLE_TYPE_FIELD) {
        const selectedResidenceTitle = getTextValue(normalizedValue);
        const residenceTitleIsUnlimited = isResidenceTitleUnlimited(
          selectedResidenceTitle
        );

        nextFormData = {
          ...nextFormData,
          [RESIDENCE_TITLE_UNLIMITED_FIELD]: residenceTitleIsUnlimited,
          [RESIDENCE_TITLE_EXPIRY_FIELD]: residenceTitleIsUnlimited
            ? ""
            : nextFormData[RESIDENCE_TITLE_EXPIRY_FIELD],
        };
      }
      const property = schema?.properties[fieldName];
      const requiredFieldMessage = _(msg`This field is required.`);
      const requiredSchema =
        schema && template?.is_required === false
          ? { ...schema, required: [] }
          : schema;
      const requiredFieldErrors = requiredSchema
        ? validateRequiredFields(
            requiredSchema,
            nextFormData,
            requiredFieldMessage
          )
        : {};
      const additionalRequiredFieldErrors = requiredSchema
        ? validateAdditionalRequiredFields(
            requiredSchema,
            nextFormData,
            requiredFieldMessage,
            _(msg`The residence title expiry date cannot be in the past.`),
            _(
              msg`A valid residence title without employment authorization cannot be accepted. Please contact HR.`
            )
          )
        : {};
      const patternFieldErrors = requiredSchema
        ? validatePatternFields(
            requiredSchema,
            nextFormData,
            requiredFieldErrors,
            _
          )
        : {};

      setFieldErrors((currentFieldErrors) => {
        let changed = false;
        const nextFieldErrors: FieldErrors = {};

        for (const [errorFieldName, errorMessage] of Object.entries(
          currentFieldErrors
        )) {
          if (
            errorMessage === requiredFieldMessage &&
            !requiredFieldErrors[errorFieldName]
          ) {
            changed = true;
            continue;
          }

          nextFieldErrors[errorFieldName] = errorMessage;
        }

        if (property && requiredSchema) {
          const requiredErrorForField = requiredFieldErrors[fieldName];
          const patternErrorForField = requiredErrorForField
            ? null
            : (patternFieldErrors[fieldName] ??
              getFieldPatternValidationError(
                fieldName,
                property,
                nextFormData,
                requiredSchema,
                _
              ));

          if (requiredErrorForField) {
            if (nextFieldErrors[fieldName] !== requiredErrorForField) {
              nextFieldErrors[fieldName] = requiredErrorForField;
              changed = true;
            }
          } else if (patternErrorForField) {
            if (nextFieldErrors[fieldName] !== patternErrorForField) {
              nextFieldErrors[fieldName] = patternErrorForField;
              changed = true;
            }
          } else if (nextFieldErrors[fieldName]) {
            delete nextFieldErrors[fieldName];
            changed = true;
          }
        }

        for (const additionalFieldName of [
          RESIDENCE_TITLE_TYPE_FIELD,
          RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
          RESIDENCE_TITLE_EXPIRY_FIELD,
        ] as const) {
          const additionalRequiredError =
            additionalRequiredFieldErrors[additionalFieldName];
          const hasExistingAdditionalError = Boolean(
            currentFieldErrors[additionalFieldName]
          );
          const isEditedField = additionalFieldName === fieldName;

          if (additionalRequiredError) {
            if (
              (hasExistingAdditionalError || isEditedField) &&
              nextFieldErrors[additionalFieldName] !== additionalRequiredError
            ) {
              nextFieldErrors[additionalFieldName] = additionalRequiredError;
              changed = true;
            }
          } else if (nextFieldErrors[additionalFieldName]) {
            delete nextFieldErrors[additionalFieldName];
            changed = true;
          }
        }

        return changed ? nextFieldErrors : currentFieldErrors;
      });

      return nextFormData;
    });
  }

  async function handleUpload() {
    if (!uploadFile) {
      return;
    }

    if (!isCurrentStepEditable) {
      setUploadFeedback({
        tone: "error",
        message: _(
          msg`Files can only be uploaded while this onboarding step is still editable.`
        ),
      });
      return;
    }

    try {
      const startedStepIndex = currentStepIndexRef.current;
      setUploading(true);
      setError(null);
      setUploadFeedback(null);

      const targetSubmission =
        submission ?? (await persistCurrentStep("draft"));
      if (!targetSubmission) {
        setError(null);
        setUploadFeedback({
          tone: "error",
          message: _(
            msg`We couldn't prepare this step for file uploads. Please try saving your draft again.`
          ),
        });
        return;
      }

      const targetUploadDocumentType =
        stepUploadDocumentType ?? uploadDocumentType;

      const uploadedFileResponse = await uploadOnboardingFile(
        targetSubmission.id,
        uploadFile,
        targetUploadDocumentType
      );

      if (currentStepIndexRef.current !== startedStepIndex) {
        return;
      }

      setUploadedFiles((currentFiles) => [
        ...currentFiles,
        {
          ...uploadedFileResponse,
          documentType: targetUploadDocumentType,
        },
      ]);
      setUploadFeedback({
        tone: "success",
        message: _(msg`File uploaded successfully.`),
      });
      setUploadFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const validationMessage =
        err instanceof ApiError && err.statusCode === 422
          ? err.message.length > 0
            ? formatValidationFallbackMessage(err.message, schema, _)
            : _(msg`Please review the highlighted fields and try again.`)
          : null;

      setUploadFeedback({
        tone: "error",
        message:
          validationMessage ??
          getLocalizedErrorMessage(err, _, {
            fallback: msg`Failed to upload file`,
          }),
      });
    } finally {
      setUploading(false);
    }
  }

  const entryFeedbackBanner =
    entryFeedback && currentStepIndex === 0 ? (
      <div
        className={
          entryFeedback.tone === "error"
            ? "mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
            : "mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30"
        }
      >
        <Text
          className={
            entryFeedback.tone === "error"
              ? "text-red-800 dark:text-red-200"
              : "text-emerald-800 dark:text-emerald-200"
          }
        >
          {entryFeedback.message}
        </Text>
      </div>
    ) : null;

  if (loading && steps.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Text>
          <Trans>Loading onboarding...</Trans>
        </Text>
      </div>
    );
  }

  if (error && steps.length === 0) {
    return (
      <div>
        {entryFeedbackBanner}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <Text className="text-red-800">{error}</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-zinc-900">
        <Heading className="mb-6">
          <Trans>Welcome to SecPal Onboarding</Trans>
        </Heading>

        <ProgressIndicator
          currentStep={currentStepIndex + 1}
          totalSteps={steps.length}
        />

        {entryFeedbackBanner}

        {feedback ? (
          <div
            ref={feedback.tone === "error" ? onboardingErrorRef : null}
            tabIndex={feedback.tone === "error" ? -1 : undefined}
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live={feedback.tone === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={
              feedback.tone === "error"
                ? "mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
                : "mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30"
            }
          >
            <Text
              className={
                feedback.tone === "error"
                  ? "text-red-800 dark:text-red-200"
                  : "text-emerald-800 dark:text-emerald-200"
              }
            >
              {feedback.message}
            </Text>
          </div>
        ) : null}
        {error ? (
          <div
            ref={onboardingErrorRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
          >
            <Text className="text-red-800 dark:text-red-200">{error}</Text>
          </div>
        ) : null}

        {template && (
          <div>
            {currentStepIndex === 0 ? (
              <OnboardingStepsOverview steps={steps} />
            ) : null}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Heading level={2} className="mb-0">
                {template.title ?? template.name}
              </Heading>
              {template.is_required === false ? (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Trans>Optional</Trans>
                </span>
              ) : null}
            </div>

            {template.description ? (
              <Text className="mb-6 text-zinc-600 dark:text-zinc-400">
                {template.description}
              </Text>
            ) : null}

            {schema ? (
              <Fieldset>
                <FieldGroup>
                  {Object.entries(schema.properties)
                    .filter(([fieldName]) =>
                      isOnboardingFieldVisible(fieldName, formData)
                    )
                    .map(([fieldName, property]) => (
                      <SchemaFieldRenderer
                        key={fieldName}
                        fieldName={fieldName}
                        property={property}
                        dynamicArrayOptions={
                          fieldName === "nationalities" &&
                          nationalityOptions.length > 0
                            ? nationalityOptions.map((option) => ({
                                value: option.code,
                                label: `${option.name} (${option.code})`,
                              }))
                            : undefined
                        }
                        error={fieldErrors[fieldName]}
                        readOnly={!isCurrentStepEditable}
                        required={
                          schema.required.includes(fieldName) ||
                          isConditionallyRequiredOnboardingField(
                            fieldName,
                            formData
                          )
                        }
                        formData={formData}
                        onChange={handleFieldChange}
                      />
                    ))}
                  {requiresResidenceTitleQuestion(formData.nationalities) ? (
                    <Field>
                      <Label>
                        <Trans>Residence title type</Trans> *
                      </Label>
                      <Description>
                        <Trans>
                          Based on the selected nationality, please specify
                          which valid German residence title is available.
                        </Trans>
                      </Description>
                      <Select
                        aria-label={_(msg`Residence title type`)}
                        disabled={!isCurrentStepEditable}
                        invalid={Boolean(
                          fieldErrors[RESIDENCE_TITLE_TYPE_FIELD]
                        )}
                        name={RESIDENCE_TITLE_TYPE_FIELD}
                        required={isCurrentStepEditable}
                        value={getTextValue(
                          formData[RESIDENCE_TITLE_TYPE_FIELD]
                        )}
                        onChange={(event) =>
                          handleFieldChange(
                            RESIDENCE_TITLE_TYPE_FIELD,
                            event.target.value
                          )
                        }
                      >
                        <option value="">
                          {_(msg`Select residence title`)}
                        </option>
                        {RESIDENCE_TITLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </Select>
                      {fieldErrors[RESIDENCE_TITLE_TYPE_FIELD] ? (
                        <ErrorMessage>
                          {fieldErrors[RESIDENCE_TITLE_TYPE_FIELD]}
                        </ErrorMessage>
                      ) : null}
                    </Field>
                  ) : null}
                  {requiresResidenceTitleQuestion(formData.nationalities) ? (
                    <Field>
                      <Label>
                        <Trans>Employment permitted</Trans> *
                      </Label>
                      <Description>
                        <Trans>
                          Is employment permitted for this residence title in
                          Germany?
                        </Trans>
                      </Description>
                      <Select
                        aria-label={_(msg`Employment permitted`)}
                        disabled={!isCurrentStepEditable}
                        invalid={Boolean(
                          fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                        )}
                        name={RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD}
                        required={isCurrentStepEditable}
                        value={getTextValue(
                          formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                        )}
                        onChange={(event) =>
                          handleFieldChange(
                            RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
                            event.target.value
                          )
                        }
                      >
                        <option value="">{_(msg`Select an option`)}</option>
                        <option value="yes">{_(msg`Yes`)}</option>
                        <option value="no">{_(msg`No`)}</option>
                      </Select>
                      {fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] ? (
                        <ErrorMessage>
                          {
                            fieldErrors[
                              RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD
                            ]
                          }
                        </ErrorMessage>
                      ) : null}
                    </Field>
                  ) : null}
                  {isOnboardingFieldVisible(
                    RESIDENCE_TITLE_EXPIRY_FIELD,
                    formData
                  ) ? (
                    <Field>
                      <Label>
                        <Trans>Residence title valid until</Trans> *
                      </Label>
                      <Description>
                        <Trans>
                          Enter the expiry date if the residence title is
                          limited.
                        </Trans>
                      </Description>
                      <Input
                        aria-label={_(msg`Residence title valid until`)}
                        disabled={!isCurrentStepEditable}
                        invalid={Boolean(
                          fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD]
                        )}
                        type="date"
                        name={RESIDENCE_TITLE_EXPIRY_FIELD}
                        required={isCurrentStepEditable}
                        value={getTextValue(
                          formData[RESIDENCE_TITLE_EXPIRY_FIELD]
                        )}
                        onChange={(event) =>
                          handleFieldChange(
                            RESIDENCE_TITLE_EXPIRY_FIELD,
                            event.target.value
                          )
                        }
                      />
                      {fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD] ? (
                        <ErrorMessage>
                          {fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD]}
                        </ErrorMessage>
                      ) : null}
                    </Field>
                  ) : null}
                </FieldGroup>
              </Fieldset>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                <Text className="text-amber-800 dark:text-amber-200">
                  <Trans>
                    This onboarding step uses a schema we cannot render yet.
                  </Trans>
                </Text>
              </div>
            )}

            <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <Heading level={3} className="mb-3">
                {stepUploadDocumentType ? (
                  <Trans>Identity Document Upload</Trans>
                ) : (
                  <Trans>Supporting Documents</Trans>
                )}
              </Heading>
              <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {stepUploadDocumentType ? (
                  <Trans>
                    Please upload your identity card or passport (PDF, JPG,
                    JPEG, PNG; max. 10 MB).
                  </Trans>
                ) : (
                  <Trans>
                    On every onboarding step you can upload PDF, JPG, or PNG
                    files up to 10 MB — choose contract, identity document, or
                    banking verification as appropriate.
                  </Trans>
                )}
              </Text>

              {!submission ? (
                <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <Trans>
                    Your current answers will be saved as a draft before the
                    first file upload.
                  </Trans>
                </Text>
              ) : null}

              {uploadFeedback ? (
                <div
                  role={uploadFeedback.tone === "error" ? "alert" : "status"}
                  aria-live={
                    uploadFeedback.tone === "error" ? "assertive" : "polite"
                  }
                  aria-atomic="true"
                  className={
                    uploadFeedback.tone === "error"
                      ? "mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/30"
                      : "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30"
                  }
                >
                  <Text
                    className={
                      uploadFeedback.tone === "error"
                        ? "text-red-800 dark:text-red-200"
                        : "text-emerald-800 dark:text-emerald-200"
                    }
                  >
                    {uploadFeedback.message}
                  </Text>
                </div>
              ) : null}

              {isCurrentStepEditable ? (
                <>
                  <Fieldset>
                    <FieldGroup>
                      {!stepUploadDocumentType ? (
                        <Field>
                          <Label>
                            <Trans>Document Type</Trans>
                          </Label>
                          <Description>
                            <Trans>
                              Choose the attachment category that best matches
                              the file.
                            </Trans>
                          </Description>
                          <Select
                            aria-label={_(msg`Document Type`)}
                            value={uploadDocumentType}
                            onChange={(event) =>
                              setUploadDocumentType(
                                event.target.value as OnboardingDocumentType
                              )
                            }
                          >
                            <option value="contract">{_(msg`Contract`)}</option>
                            <option value="id_document">
                              {_(msg`Identity Document`)}
                            </option>
                            <option value="banking_details">
                              {_(msg`Banking Details`)}
                            </option>
                          </Select>
                        </Field>
                      ) : null}

                      <Field>
                        <Label>
                          <Trans>Attachment</Trans>
                        </Label>
                        <Description>
                          <Trans>Accepted formats: PDF, JPG, JPEG, PNG.</Trans>
                        </Description>
                        <input
                          ref={fileInputRef}
                          aria-label={_(msg`Attachment`)}
                          accept={ONBOARDING_UPLOAD_ACCEPT}
                          className="block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:border-white/10 dark:bg-white/5 dark:text-white dark:file:bg-white/10 dark:file:text-white"
                          type="file"
                          onChange={(event) =>
                            setUploadFile(event.target.files?.[0] ?? null)
                          }
                        />
                      </Field>
                    </FieldGroup>
                  </Fieldset>

                  <div className="mt-4 flex items-center gap-4">
                    <Button
                      disabled={!uploadFile || saving || uploading}
                      onClick={handleUpload}
                    >
                      {uploading ? (
                        <Trans>Uploading...</Trans>
                      ) : (
                        <Trans>Upload File</Trans>
                      )}
                    </Button>
                    {uploadFile ? (
                      <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                        {uploadFile.name}
                      </Text>
                    ) : null}
                  </div>

                  {uploadedFiles.length > 0 ? (
                    <div className="mt-4">
                      <Text className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        <Trans>Uploaded in this session</Trans>
                      </Text>
                      <ul className="space-y-2">
                        {uploadedFiles.map((uploadedFile) => (
                          <li
                            key={uploadedFile.id}
                            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            <span className="font-medium">
                              {uploadedFile.filename}
                            </span>
                            <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                              {uploadedFile.documentType === "contract"
                                ? _(msg`Contract`)
                                : uploadedFile.documentType === "id_document"
                                  ? _(msg`Identity Document`)
                                  : _(msg`Banking Details`)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  <Trans>
                    Files can only be uploaded while this onboarding step is
                    still editable.
                  </Trans>
                </Text>
              )}
            </div>

            <StepNavigation
              currentStep={currentStepIndex + 1}
              totalSteps={steps.length}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
              onSkipStep={handleSkipStep}
              showSkipStep={template.is_required === false}
              isStepEditable={isCurrentStepEditable}
              canGoNext={!saving && !uploading}
              isBusy={saving || uploading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
