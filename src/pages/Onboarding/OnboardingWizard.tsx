// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createOnboardingSubmission,
  deleteOnboardingFile,
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
import { fetchEmployee } from "../../services/employeeApi";
import { ApiError } from "../../services/ApiError";
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from "../../components/checkbox";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Combobox, ComboboxOption } from "../../components/combobox";
import { Radio, RadioField, RadioGroup } from "../../components/radio";
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
import { AuthContext } from "../../contexts/auth-context";
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
type OnboardingIdDocumentSubtype =
  | "identity_document"
  | "identity_document_front"
  | "identity_document_back"
  | "proof_of_residence"
  | "residence_permit_front"
  | "residence_permit_back";
type IdentityDocumentKind = "id_card" | "passport";

interface UploadedOnboardingFile {
  id: string;
  filename: string;
  documentType: OnboardingDocumentType;
  documentSubtype: OnboardingIdDocumentSubtype | null;
}

const ONBOARDING_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png";
const EMPLOYEE_ONBOARDING_HR_MANAGED_FIELDS = new Set(["intended_activities"]);
const FIRST_EMERGENCY_CONTACT_FIELD_PREFIX = "contact_1_";
const SECOND_EMERGENCY_CONTACT_FIELD_PREFIX = "contact_2_";
const EMERGENCY_CONTACT_NAME_FIELDS = ["contact_1_name", "contact_2_name"];
const SINGLE_VALUE_ARRAY_FIELDS = new Set(["nationalities"]);
const CONTRACT_START_DATE_FIELD = "contract_start_date";
const RESIDENCE_TITLE_TYPE_FIELD = "residence_permit_title";
const RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD =
  "residence_permit_employment_allowed";
const RESIDENCE_TITLE_UNLIMITED_FIELD = "residence_permit_unlimited";
const RESIDENCE_TITLE_EXPIRY_FIELD = "residence_permit_expiry";
const RESIDENCE_TITLE_CUSTOM_FIELDS = new Set([
  RESIDENCE_TITLE_TYPE_FIELD,
  RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
  RESIDENCE_TITLE_UNLIMITED_FIELD,
  RESIDENCE_TITLE_EXPIRY_FIELD,
]);
const ID_DOCUMENT_UPLOAD_NOW_FIELD = "id_document_upload_now";
const ID_DOCUMENT_KIND_FIELD = "id_document_kind";
const RESIDENCE_TITLE_UPLOAD_NOW_FIELD = "residence_permit_upload_now";
const RESIDENCE_TITLE_OPTIONS = [
  {
    value: "Aufenthaltserlaubnis",
    isUnlimited: false,
    labelDe: "Aufenthaltserlaubnis",
    labelEn: "Temporary residence permit",
  },
  {
    value: "Blaue Karte EU",
    isUnlimited: false,
    labelDe: "Blaue Karte EU",
    labelEn: "EU Blue Card",
  },
  {
    value: "ICT-Karte",
    isUnlimited: false,
    labelDe: "ICT-Karte",
    labelEn: "ICT Card",
  },
  {
    value: "Mobile-ICT-Karte",
    isUnlimited: false,
    labelDe: "Mobile-ICT-Karte",
    labelEn: "Mobile ICT Card",
  },
  {
    value: "Niederlassungserlaubnis",
    isUnlimited: true,
    labelDe: "Niederlassungserlaubnis",
    labelEn: "Settlement permit",
  },
  {
    value: "Erlaubnis zum Daueraufenthalt-EU",
    isUnlimited: true,
    labelDe: "Erlaubnis zum Daueraufenthalt-EU",
    labelEn: "EU long-term residence permit",
  },
  {
    value: "Chancenkarte",
    isUnlimited: false,
    labelDe: "Chancenkarte",
    labelEn: "Opportunity card",
  },
  {
    value: "Aufenthaltsgestattung",
    isUnlimited: false,
    labelDe: "Aufenthaltsgestattung",
    labelEn: "Temporary permission to stay",
  },
  {
    value: "Duldung",
    isUnlimited: false,
    labelDe: "Duldung",
    labelEn: "Tolerated stay permit",
  },
  {
    value: "Visum",
    isUnlimited: false,
    labelDe: "Visum",
    labelEn: "Visa",
  },
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

function getResidenceTitleOptionLabel(
  option: (typeof RESIDENCE_TITLE_OPTIONS)[number],
  locale: string
): string {
  return locale.toLowerCase().startsWith("de")
    ? option.labelDe
    : option.labelEn;
}

function getIdDocumentSubtypeLabel(
  subtype: OnboardingIdDocumentSubtype,
  locale: string,
  primaryNationalityCode: string | null = null,
  identityDocumentKind: IdentityDocumentKind | null = null
): string {
  const isGerman = locale.toLowerCase().startsWith("de");

  switch (subtype) {
    case "identity_document":
      if (identityDocumentKind === "id_card") {
        return isGerman ? "Personalausweis" : "Identity card";
      }

      if (identityDocumentKind === "passport") {
        return isGerman ? "Reisepass" : "Passport";
      }

      if (primaryNationalityCode && primaryNationalityCode !== "DE") {
        return isGerman ? "Reisepass" : "Passport";
      }

      return isGerman
        ? "Personalausweis oder Reisepass"
        : "Identity card or passport";
    case "proof_of_residence":
      return isGerman
        ? "Meldebestätigung (falls Adresse nicht auf dem Ausweis steht)"
        : "Proof of residence registration (if address is not shown on ID)";
    case "identity_document_front":
      return isGerman
        ? "Ausweisdokument (Vorderseite)"
        : "Identity document (front side)";
    case "identity_document_back":
      return isGerman
        ? "Ausweisdokument (Rückseite)"
        : "Identity document (back side)";
    case "residence_permit_front":
      return isGerman
        ? "Aufenthaltstitel (Vorderseite)"
        : "Residence title (front side)";
    case "residence_permit_back":
      return isGerman
        ? "Aufenthaltstitel (Rückseite)"
        : "Residence title (back side)";
    default:
      return subtype;
  }
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
  formData: Record<string, unknown>,
  schema: OnboardingObjectSchema | null
): boolean {
  const showIdentityUploadChoice =
    getStepUploadDocumentType(schema, formData.nationalities) !== null;

  if (fieldName === ID_DOCUMENT_UPLOAD_NOW_FIELD) {
    return showIdentityUploadChoice;
  }

  if (fieldName === ID_DOCUMENT_KIND_FIELD) {
    return (
      showIdentityUploadChoice &&
      getPrimaryNationalityCode(formData.nationalities) === "DE" &&
      getUploadNowSelection(formData[ID_DOCUMENT_UPLOAD_NOW_FIELD]) === "yes"
    );
  }

  const showResidenceTitleFields =
    Boolean(schema && "nationalities" in schema.properties) &&
    requiresResidenceTitleQuestion(formData.nationalities);

  if (fieldName === RESIDENCE_TITLE_UPLOAD_NOW_FIELD) {
    return showResidenceTitleFields;
  }

  if (
    fieldName === RESIDENCE_TITLE_TYPE_FIELD ||
    fieldName === RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD ||
    fieldName === RESIDENCE_TITLE_UNLIMITED_FIELD
  ) {
    return showResidenceTitleFields;
  }

  if (fieldName === RESIDENCE_TITLE_EXPIRY_FIELD) {
    const selectedResidenceTitle = getTextValue(
      formData[RESIDENCE_TITLE_TYPE_FIELD]
    ).trim();
    return (
      showResidenceTitleFields &&
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
  formData: Record<string, unknown>,
  schema: OnboardingObjectSchema | null
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(formData)
      .filter(([fieldName]) =>
        isOnboardingFieldVisible(fieldName, formData, schema)
      )
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

function getUploadNowSelection(value: unknown): "yes" | "no" | null {
  const normalized = getTextValue(value).trim().toLowerCase();
  if (normalized === "yes" || normalized === "no") {
    return normalized;
  }

  return null;
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

  if (!getPrimaryNationalityCode(nationalitiesValue)) {
    return null;
  }

  return "id_document";
}

function getContractStartDateFromSteps(steps: OnboardingStep[]): string | null {
  for (const step of steps) {
    const formData = step.submission?.form_data;
    if (!isRecord(formData)) {
      continue;
    }

    const contractStartDate = getContractStartDateFromFormData(formData);
    if (contractStartDate) {
      return contractStartDate;
    }
  }

  return null;
}

function getEmployeeIdFromSteps(steps: OnboardingStep[]): string | null {
  for (const step of steps) {
    const employeeId = step.submission?.employee_id;
    if (typeof employeeId === "string" && employeeId.trim().length > 0) {
      return employeeId;
    }
  }

  return null;
}

function validateAdditionalRequiredFields(
  schema: OnboardingObjectSchema | null,
  formData: Record<string, unknown>,
  requiredFieldMessage: string,
  expiredResidenceTitleMessage: string,
  residenceTitleBeforeContractStartMessage: string,
  employmentNotPermittedMessage: string,
  enforceExpiryBusinessRules = true,
  contractStartDateFallback: string | null = null
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
  const residenceTitleExpiry = getTextValue(
    formData[RESIDENCE_TITLE_EXPIRY_FIELD]
  ).trim();
  const contractStartDate = getContractStartDateFromFormData(
    formData,
    contractStartDateFallback
  );
  const shouldAskEmploymentQuestion = canAskEmploymentForResidenceTitle(
    selectedResidenceTitle,
    residenceTitleExpiry,
    contractStartDate
  );
  const employmentAllowed = getTextValue(
    formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
  )
    .trim()
    .toLowerCase();

  if (selectedResidenceTitle.length === 0) {
    errors[RESIDENCE_TITLE_TYPE_FIELD] = requiredFieldMessage;
  }
  if (shouldAskEmploymentQuestion) {
    if (employmentAllowed.length === 0) {
      errors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] = requiredFieldMessage;
    } else if (employmentAllowed === "no") {
      errors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] =
        employmentNotPermittedMessage;
    }
  }

  if (
    selectedResidenceTitle.length > 0 &&
    !isResidenceTitleUnlimited(selectedResidenceTitle)
  ) {
    if (residenceTitleExpiry.length === 0) {
      errors[RESIDENCE_TITLE_EXPIRY_FIELD] = requiredFieldMessage;
    } else if (enforceExpiryBusinessRules) {
      if (
        !contractStartDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(residenceTitleExpiry) &&
        residenceTitleExpiry >= getLocalTodayIsoDate()
      ) {
        errors[RESIDENCE_TITLE_EXPIRY_FIELD] =
          residenceTitleBeforeContractStartMessage;
      } else if (
        /^\d{4}-\d{2}-\d{2}$/.test(residenceTitleExpiry) &&
        residenceTitleExpiry < getLocalTodayIsoDate()
      ) {
        errors[RESIDENCE_TITLE_EXPIRY_FIELD] = expiredResidenceTitleMessage;
      } else {
        if (
          contractStartDate &&
          /^\d{4}-\d{2}-\d{2}$/.test(residenceTitleExpiry) &&
          residenceTitleExpiry <= contractStartDate
        ) {
          errors[RESIDENCE_TITLE_EXPIRY_FIELD] =
            residenceTitleBeforeContractStartMessage;
        }
      }
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

function isStrictFutureIsoDate(dateValue: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue) && dateValue > getLocalTodayIsoDate()
  );
}

function getContractStartDateFromFormData(
  formData: Record<string, unknown>,
  fallbackContractStartDate: string | null = null
): string | null {
  const value = getTextValue(formData[CONTRACT_START_DATE_FIELD]).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (
    fallbackContractStartDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(fallbackContractStartDate)
  ) {
    return fallbackContractStartDate;
  }

  return null;
}

function canAskEmploymentForResidenceTitle(
  selectedResidenceTitle: string,
  residenceTitleExpiry: string,
  contractStartDate: string | null
): boolean {
  const normalizedTitle = selectedResidenceTitle.trim();
  if (normalizedTitle.length === 0) {
    return false;
  }

  if (isResidenceTitleUnlimited(normalizedTitle)) {
    return true;
  }

  if (!contractStartDate) {
    return false;
  }

  const normalizedExpiry = residenceTitleExpiry.trim();
  if (!isStrictFutureIsoDate(normalizedExpiry)) {
    return false;
  }

  return normalizedExpiry > contractStartDate;
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

    if (!isOnboardingFieldVisible(fieldName, formData, schema)) {
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
      if (!isOnboardingFieldVisible(fieldName, formData, schema)) {
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
  if (/failed to upload/i.test(message)) {
    return translate(msg`Failed to upload file`);
  }

  if (/pattern/i.test(message)) {
    return formatSupplementalValidationMessage(message, schema, translate);
  }

  return message;
}

function getFirstApiValidationErrorMessage(error: ApiError): string | null {
  if (!error.errors) {
    return null;
  }

  for (const messages of Object.values(error.errors)) {
    const firstMessage = messages?.[0];
    if (typeof firstMessage === "string" && firstMessage.trim().length > 0) {
      return firstMessage;
    }
  }

  return null;
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
            Document uploads are only shown where a specific document is
            required for the current onboarding step.
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
  const { _, i18n } = useLingui();
  const authContext = useContext(AuthContext);
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
  const [uploadNowSelectionOverride, setUploadNowSelection] = useState<
    "yes" | "no" | null | undefined
  >(undefined);
  const [
    residenceTitleUploadNowSelectionOverride,
    setResidenceTitleUploadNowSelection,
  ] = useState<"yes" | "no" | null | undefined>(undefined);
  const [identityDocumentKindOverride, setIdentityDocumentKind] = useState<
    IdentityDocumentKind | null | undefined
  >(undefined);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadContext, setUploadContext] = useState<
    "identity_document" | "residence_permit" | null
  >(null);
  const [uploadFeedback, setUploadFeedback] = useState<WizardFeedback | null>(
    null
  );
  const [uploadedFilesByTemplateId, setUploadedFilesByTemplateId] = useState<
    Record<string, UploadedOnboardingFile[]>
  >({});
  const [employeeContractStartDate, setEmployeeContractStartDate] = useState<
    string | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const onboardingErrorRef = useRef<HTMLDivElement | null>(null);
  const currentStepIndexRef = useRef(0);
  const templateCacheRef = useRef<Map<string, OnboardingFormTemplate>>(
    new Map()
  );
  const currentStepTemplateId = steps[currentStepIndex]?.template_id;
  const schema = template ? getObjectSchema(template.form_schema) : null;
  const contractStartDateFromAuth =
    authContext?.user?.employee?.contract_start_date ?? null;
  const employeeIdFromSteps = useMemo(
    () => getEmployeeIdFromSteps(steps),
    [steps]
  );
  const contractStartDateFromOtherSteps = getContractStartDateFromSteps(steps);
  const resolvedEmployeeContractStartDate =
    typeof contractStartDateFromAuth === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(contractStartDateFromAuth)
      ? contractStartDateFromAuth
      : employeeIdFromSteps
        ? employeeContractStartDate
        : null;
  const contractStartDateFallback =
    resolvedEmployeeContractStartDate ??
    contractStartDateFromOtherSteps ??
    contractStartDateFromAuth;
  const stepUploadDocumentType = getStepUploadDocumentType(
    schema,
    formData.nationalities
  );
  const primaryNationalityCode = getPrimaryNationalityCode(
    formData.nationalities
  );
  const canUploadBasedOnNationality = primaryNationalityCode !== null;
  const shouldAskIdentityDocumentKind = primaryNationalityCode === "DE";
  const requiresResidenceTitleDocuments = requiresResidenceTitleQuestion(
    formData.nationalities
  );
  const hasResidenceFollowupProgress =
    getTextValue(formData[RESIDENCE_TITLE_TYPE_FIELD]).trim().length > 0 ||
    getTextValue(formData[RESIDENCE_TITLE_EXPIRY_FIELD]).trim().length > 0 ||
    getTextValue(formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]).trim()
      .length > 0 ||
    getUploadNowSelection(formData[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]) !== null;
  const persistedUploadNow =
    getUploadNowSelection(formData[ID_DOCUMENT_UPLOAD_NOW_FIELD]) ??
    (hasResidenceFollowupProgress ? "no" : null);
  const persistedKindRaw = getTextValue(formData[ID_DOCUMENT_KIND_FIELD])
    .trim()
    .toLowerCase();
  const persistedKind: IdentityDocumentKind | null =
    persistedKindRaw === "id_card" || persistedKindRaw === "passport"
      ? persistedKindRaw
      : null;
  const persistedResidenceTitleUploadNow = getUploadNowSelection(
    formData[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]
  );
  const uploadNowSelection = canUploadBasedOnNationality
    ? uploadNowSelectionOverride !== undefined
      ? uploadNowSelectionOverride
      : persistedUploadNow
    : null;
  const residenceTitleUploadNowSelection =
    residenceTitleUploadNowSelectionOverride !== undefined
      ? residenceTitleUploadNowSelectionOverride
      : persistedResidenceTitleUploadNow;
  const identityDocumentKind = canUploadBasedOnNationality
    ? shouldAskIdentityDocumentKind
      ? identityDocumentKindOverride !== undefined
        ? identityDocumentKindOverride
        : persistedKind
      : "passport"
    : null;
  const uploadedFiles = useMemo(
    () =>
      currentStepTemplateId
        ? (uploadedFilesByTemplateId[currentStepTemplateId] ?? [])
        : [],
    [currentStepTemplateId, uploadedFilesByTemplateId]
  );
  const selectedResidenceTitle = getTextValue(
    formData[RESIDENCE_TITLE_TYPE_FIELD]
  ).trim();
  const contractStartDate = getContractStartDateFromFormData(
    formData,
    contractStartDateFallback
  );
  const residenceTitleExpiryValue = getTextValue(
    formData[RESIDENCE_TITLE_EXPIRY_FIELD]
  ).trim();
  const employmentPermissionValue = getTextValue(
    formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
  )
    .trim()
    .toLowerCase();
  const uploadedIdentityFiles = uploadedFiles.filter(
    (file) =>
      file.documentSubtype === "identity_document" ||
      file.documentSubtype === "identity_document_front" ||
      file.documentSubtype === "identity_document_back"
  );
  const uploadedResidenceTitleFiles = uploadedFiles.filter(
    (file) =>
      file.documentSubtype === "residence_permit_front" ||
      file.documentSubtype === "residence_permit_back"
  );
  const isIdentityUploadSectionCompleted =
    !stepUploadDocumentType ||
    uploadNowSelection === "no" ||
    (uploadNowSelection === "yes" && uploadedIdentityFiles.length > 0);
  const areResidenceTitleFollowupFieldsUnlocked =
    isIdentityUploadSectionCompleted;
  const shouldAskEmploymentQuestion =
    areResidenceTitleFollowupFieldsUnlocked &&
    canAskEmploymentForResidenceTitle(
      selectedResidenceTitle,
      residenceTitleExpiryValue,
      contractStartDate
    );
  const shouldAskResidenceTitleUploadNow =
    requiresResidenceTitleDocuments &&
    shouldAskEmploymentQuestion &&
    employmentPermissionValue === "yes";
  const isEmploymentHardBlocked =
    shouldAskEmploymentQuestion && employmentPermissionValue === "no";
  const isCurrentStepEditable = isEditableSubmission(submission);

  function resetUploadState() {
    setUploading(false);
    setUploadNowSelection(undefined);
    setResidenceTitleUploadNowSelection(undefined);
    setIdentityDocumentKind(undefined);
    setUploadFiles([]);
    setUploadContext(null);
    setUploadFeedback(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearUploadRequirementErrors() {
    setFieldErrors((currentErrors) => {
      const hasIdentityUploadError = Boolean(
        currentErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD]
      );
      const hasResidenceUploadError = Boolean(
        currentErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]
      );

      if (!hasIdentityUploadError && !hasResidenceUploadError) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD];
      delete nextErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD];
      return nextErrors;
    });
    setFeedback((currentFeedback) =>
      currentFeedback?.tone === "error" ? null : currentFeedback
    );
  }

  function persistUploadedFilesForCurrentStep(files: UploadedOnboardingFile[]) {
    if (!currentStepTemplateId) {
      return;
    }

    setUploadedFilesByTemplateId((currentMap) => ({
      ...currentMap,
      [currentStepTemplateId]: files,
    }));
  }

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    const hasAuthContractStartDate =
      typeof contractStartDateFromAuth === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(contractStartDateFromAuth);

    if (hasAuthContractStartDate || !employeeIdFromSteps) {
      return;
    }

    let active = true;

    void fetchEmployee(employeeIdFromSteps)
      .then((employee) => {
        if (!active) {
          return;
        }

        const contractStartDate =
          typeof employee.contract_start_date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(employee.contract_start_date)
            ? employee.contract_start_date
            : null;
        setEmployeeContractStartDate(contractStartDate);
      })
      .catch(() => {
        if (active) {
          setEmployeeContractStartDate(null);
        }
      });

    return () => {
      active = false;
    };
  }, [employeeIdFromSteps, contractStartDateFromAuth]);

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
      schema: OnboardingObjectSchema | null;
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

      const stepSchema = await resolveStepValidationSchema(step);

      stepsToSubmit.push({
        index,
        submission: step.submission,
        schema: stepSchema,
      });
    }

    if (stepsToSubmit.length === 0) {
      return true;
    }

    let failingStepIndex: number | null = null;

    try {
      setSaving(true);
      setError(null);

      for (const {
        index,
        submission: stepSubmission,
        schema: stepSchema,
      } of stepsToSubmit) {
        failingStepIndex = index;
        const requiredFieldMessage = _(msg`This field is required.`);
        const stepFormData = sanitizeEmployeeOnboardingFormData(
          (stepSubmission.form_data as Record<string, unknown> | null) ?? {},
          stepSchema
        );
        const requiredFieldErrors = stepSchema
          ? validateRequiredFields(
              stepSchema,
              stepFormData,
              requiredFieldMessage
            )
          : {};
        const additionalRequiredFieldErrors = stepSchema
          ? validateAdditionalRequiredFields(
              stepSchema,
              stepFormData,
              requiredFieldMessage,
              _(msg`The residence title expiry date cannot be in the past.`),
              _(
                msg`The residence title must remain valid after your contract start date.`
              ),
              _(
                msg`A valid residence title without employment authorization cannot be accepted. Please contact HR.`
              ),
              true,
              contractStartDateFallback
            )
          : {};
        const patternFieldErrors = stepSchema
          ? validatePatternFields(
              stepSchema,
              stepFormData,
              requiredFieldErrors,
              _
            )
          : {};
        const stepFieldErrors = {
          ...requiredFieldErrors,
          ...additionalRequiredFieldErrors,
          ...patternFieldErrors,
        };

        if (Object.keys(stepFieldErrors).length > 0) {
          const failedStep = steps[index];
          const failedStepState = getOnboardingStepState(failedStep);

          setLoading(true);
          setError(null);
          setFeedback({
            tone: "error",
            message: _(
              msg`We couldn't submit the form yet. Please review the highlighted fields.`
            ),
          });
          setFieldErrors(stepFieldErrors);
          resetUploadState();
          setTemplate(null);
          setSubmission(failedStepState.submission);
          setFormData(failedStepState.formData);
          setCurrentStepIndex(index);
          setLoading(false);
          return false;
        }

        const savedSubmission = await updateOnboardingSubmission(
          stepSubmission.id,
          {
            form_data: stepFormData,
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
          : ((submission?.form_data as Record<string, unknown> | null) ?? {}),
        schema
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
            isOnboardingFieldVisible(fieldKey, formData, schema);

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
        msg`The residence title must remain valid after your contract start date.`
      ),
      _(
        msg`A valid residence title without employment authorization cannot be accepted. Please contact HR.`
      ),
      true,
      contractStartDateFallback
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

    if (stepUploadDocumentType) {
      if (uploadNowSelection == null) {
        nextFieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD] = _(
          msg`Please choose whether you want to upload your identity document now.`
        );
      } else if (
        uploadNowSelection === "yes" &&
        uploadedIdentityFiles.length === 0
      ) {
        nextFieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD] = _(
          msg`Please upload at least one identity document file before continuing.`
        );
      }
    }

    if (shouldAskResidenceTitleUploadNow) {
      if (residenceTitleUploadNowSelection == null) {
        nextFieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD] = _(
          msg`Please choose whether you want to upload your residence title now.`
        );
      } else if (
        residenceTitleUploadNowSelection === "yes" &&
        uploadedResidenceTitleFiles.length === 0
      ) {
        nextFieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD] = _(
          msg`Please upload at least one residence title file before continuing.`
        );
      }
    }

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

  function handleFieldChange(
    fieldName: string,
    value: unknown,
    options?: { forceExpiryBusinessRules?: boolean }
  ) {
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
          [RESIDENCE_TITLE_UPLOAD_NOW_FIELD]:
            selectedResidenceTitle.trim().length > 0
              ? nextFormData[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]
              : "",
        };

        if (selectedResidenceTitle.trim().length === 0) {
          setResidenceTitleUploadNowSelection(null);
        }
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
      const enforceExpiryBusinessRules =
        options?.forceExpiryBusinessRules ??
        fieldName !== RESIDENCE_TITLE_EXPIRY_FIELD;
      const additionalRequiredFieldErrors = requiredSchema
        ? validateAdditionalRequiredFields(
            requiredSchema,
            nextFormData,
            requiredFieldMessage,
            _(msg`The residence title expiry date cannot be in the past.`),
            _(
              msg`The residence title must remain valid after your contract start date.`
            ),
            _(
              msg`A valid residence title without employment authorization cannot be accepted. Please contact HR.`
            ),
            enforceExpiryBusinessRules,
            contractStartDateFallback
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

  async function persistUploadSelections(
    targetSubmission: OnboardingSubmission,
    overrides?: {
      identityUploadNowSelection?: "yes" | "no" | null;
      identityDocumentKind?: IdentityDocumentKind | null;
      residenceTitleUploadNowSelection?: "yes" | "no" | null;
    }
  ) {
    const nextIdentityUploadNowSelection =
      overrides && "identityUploadNowSelection" in overrides
        ? (overrides.identityUploadNowSelection ?? null)
        : uploadNowSelection;
    const nextIdentityDocumentKind =
      overrides && "identityDocumentKind" in overrides
        ? (overrides.identityDocumentKind ?? null)
        : identityDocumentKind;
    const nextResidenceTitleUploadNowSelection =
      overrides && "residenceTitleUploadNowSelection" in overrides
        ? (overrides.residenceTitleUploadNowSelection ?? null)
        : residenceTitleUploadNowSelection;

    const nextFormData: Record<string, unknown> = {
      ...formData,
      [ID_DOCUMENT_UPLOAD_NOW_FIELD]: nextIdentityUploadNowSelection ?? "",
      [ID_DOCUMENT_KIND_FIELD]:
        nextIdentityUploadNowSelection === "yes" && nextIdentityDocumentKind
          ? nextIdentityDocumentKind
          : "",
      [RESIDENCE_TITLE_UPLOAD_NOW_FIELD]:
        nextResidenceTitleUploadNowSelection ?? "",
    };

    setFormData(nextFormData);

    const savedSubmission = await updateOnboardingSubmission(
      targetSubmission.id,
      {
        form_data: sanitizeEmployeeOnboardingFormData(nextFormData, schema),
        status: "draft",
      }
    );

    setSubmission(savedSubmission);
    updateCurrentStep(savedSubmission, "draft");
  }

  async function handleUpload(
    targetUploadContext:
      | "identity_document"
      | "residence_permit"
      | null = uploadContext
  ): Promise<boolean> {
    if (uploadFiles.length === 0) {
      return true;
    }

    if (!isCurrentStepEditable) {
      setUploadFeedback({
        tone: "error",
        message: _(
          msg`Files can only be uploaded while this onboarding step is still editable.`
        ),
      });
      return false;
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
        return false;
      }

      const targetUploadDocumentType = stepUploadDocumentType;
      if (!targetUploadDocumentType) {
        setUploadFeedback({
          tone: "error",
          message: _(msg`Failed to upload file`),
        });
        return false;
      }
      if (!targetUploadContext) {
        setUploadFeedback({
          tone: "error",
          message: _(msg`Please select a file to upload.`),
        });
        return false;
      }

      const uploadsToRun: Array<{
        file: File;
        subtype: OnboardingIdDocumentSubtype;
      }> = [];

      const primaryFile = uploadFiles[0] ?? null;
      const secondaryFile = uploadFiles[1] ?? null;
      if (!primaryFile) {
        return false;
      }

      if (targetUploadContext === "identity_document") {
        if (secondaryFile) {
          uploadsToRun.push(
            { file: primaryFile, subtype: "identity_document_front" },
            { file: secondaryFile, subtype: "identity_document_back" }
          );
        } else {
          uploadsToRun.push({
            file: primaryFile,
            subtype: "identity_document",
          });
        }
      } else if (secondaryFile) {
        uploadsToRun.push(
          { file: primaryFile, subtype: "residence_permit_front" },
          { file: secondaryFile, subtype: "residence_permit_back" }
        );
      } else {
        uploadsToRun.push({
          file: primaryFile,
          subtype: "residence_permit_front",
        });
      }

      if (currentStepIndexRef.current !== startedStepIndex) {
        return false;
      }

      const uploadedEntries: UploadedOnboardingFile[] = [];
      for (const uploadTarget of uploadsToRun) {
        const uploadedFileResponse = await uploadOnboardingFile(
          targetSubmission.id,
          uploadTarget.file,
          targetUploadDocumentType,
          uploadTarget.subtype
        );

        uploadedEntries.push({
          ...uploadedFileResponse,
          documentType: targetUploadDocumentType,
          documentSubtype: uploadTarget.subtype,
        });
      }

      const nextFiles = [...uploadedFiles, ...uploadedEntries];
      persistUploadedFilesForCurrentStep(nextFiles);

      try {
        if (targetUploadContext === "identity_document") {
          await persistUploadSelections(targetSubmission, {
            identityUploadNowSelection: "yes",
            identityDocumentKind:
              identityDocumentKind ??
              (shouldAskIdentityDocumentKind ? null : "passport"),
          });
        } else {
          await persistUploadSelections(targetSubmission, {
            residenceTitleUploadNowSelection: "yes",
          });
        }
      } catch {
        // Upload already succeeded; keep the user flow uninterrupted if metadata persistence fails.
      }

      clearUploadRequirementErrors();

      setUploadFeedback({
        tone: "success",
        message:
          uploadedEntries.length > 1
            ? _(msg`Files uploaded successfully.`)
            : _(msg`File uploaded successfully.`),
      });
      setUploadFiles([]);
      setUploadContext(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return true;
    } catch (err) {
      const appendHttpStatus = (
        message: string,
        statusCode: number | undefined
      ): string =>
        statusCode && statusCode > 0
          ? `${message} (HTTP ${statusCode})`
          : message;
      const firstValidationErrorMessage =
        err instanceof ApiError && err.statusCode === 422
          ? getFirstApiValidationErrorMessage(err)
          : null;

      const validationMessage =
        err instanceof ApiError
          ? err.statusCode === 422
            ? firstValidationErrorMessage !== null
              ? formatValidationFallbackMessage(
                  firstValidationErrorMessage,
                  schema,
                  _
                )
              : err.message.length > 0
                ? formatValidationFallbackMessage(err.message, schema, _)
                : _(msg`Please review the highlighted fields and try again.`)
            : err.message.length > 0
              ? appendHttpStatus(
                  formatValidationFallbackMessage(err.message, schema, _),
                  err.statusCode
                )
              : err.statusCode
                ? _(msg`File upload failed with HTTP status ${err.statusCode}.`)
                : null
          : null;

      const rawErrorMessage =
        err instanceof Error && err.message.trim().length > 0
          ? formatValidationFallbackMessage(err.message, schema, _)
          : null;

      setUploadFeedback({
        tone: "error",
        message:
          validationMessage ??
          rawErrorMessage ??
          getLocalizedErrorMessage(err, _, {
            fallback: msg`Failed to upload file`,
          }),
      });
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveUploadedFile(fileId: string) {
    if (!submission || saving || uploading) {
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
      setUploading(true);
      setError(null);
      setUploadFeedback(null);

      await deleteOnboardingFile(submission.id, fileId);

      const nextFiles = uploadedFiles.filter((file) => file.id !== fileId);
      persistUploadedFilesForCurrentStep(nextFiles);

      const remainingIdentityFiles = nextFiles.filter(
        (file) =>
          file.documentSubtype === "identity_document" ||
          file.documentSubtype === "identity_document_front" ||
          file.documentSubtype === "identity_document_back"
      );
      const remainingResidenceTitleFiles = nextFiles.filter(
        (file) =>
          file.documentSubtype === "residence_permit_front" ||
          file.documentSubtype === "residence_permit_back"
      );

      try {
        await persistUploadSelections(submission, {
          identityUploadNowSelection:
            remainingIdentityFiles.length > 0 ? "yes" : null,
          identityDocumentKind:
            remainingIdentityFiles.length > 0
              ? (identityDocumentKind ??
                (shouldAskIdentityDocumentKind ? null : "passport"))
              : null,
          residenceTitleUploadNowSelection:
            remainingResidenceTitleFiles.length > 0 ? "yes" : null,
        });
      } catch {
        // File removal already succeeded; keep UI state and avoid masking success.
      }

      setUploadFeedback({
        tone: "success",
        message: _(msg`File removed successfully.`),
      });
    } catch (err) {
      setUploadFeedback({
        tone: "error",
        message: getLocalizedErrorMessage(err, _, {
          fallback: msg`Failed to delete file`,
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
                    .filter(
                      ([fieldName]) =>
                        isOnboardingFieldVisible(fieldName, formData, schema) &&
                        !RESIDENCE_TITLE_CUSTOM_FIELDS.has(fieldName)
                    )
                    .map(([fieldName, property]) => (
                      <div key={fieldName}>
                        <SchemaFieldRenderer
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
                        {fieldName === "nationalities" &&
                        stepUploadDocumentType &&
                        isCurrentStepEditable ? (
                          <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                            <Fieldset>
                              <FieldGroup>
                                <Field>
                                  <Label>
                                    <Trans>
                                      Would you like to upload your identity
                                      document now?
                                    </Trans>
                                  </Label>
                                  <Description>
                                    <Trans>
                                      You can upload now or continue and add
                                      documents later before final submission.
                                    </Trans>
                                  </Description>
                                  <RadioGroup
                                    aria-label={_(
                                      msg`Would you like to upload your identity document now?`
                                    )}
                                    value={uploadNowSelection ?? ""}
                                    onChange={(value) => {
                                      if (value === "yes") {
                                        setUploadNowSelection("yes");
                                        clearUploadRequirementErrors();
                                        setFormData((currentFormData) => ({
                                          ...currentFormData,
                                          [ID_DOCUMENT_UPLOAD_NOW_FIELD]: "yes",
                                        }));
                                        return;
                                      }

                                      if (value === "no") {
                                        setUploadNowSelection("no");
                                        setIdentityDocumentKind(
                                          shouldAskIdentityDocumentKind
                                            ? null
                                            : "passport"
                                        );
                                        clearUploadRequirementErrors();
                                        setFormData((currentFormData) => ({
                                          ...currentFormData,
                                          [ID_DOCUMENT_UPLOAD_NOW_FIELD]: "no",
                                          [ID_DOCUMENT_KIND_FIELD]: "",
                                        }));
                                      }
                                    }}
                                    className="mt-3"
                                  >
                                    <RadioField>
                                      <Radio value="yes" />
                                      <Label>{_(msg`Yes`)}</Label>
                                    </RadioField>
                                    <RadioField>
                                      <Radio value="no" />
                                      <Label>{_(msg`No`)}</Label>
                                    </RadioField>
                                  </RadioGroup>
                                  {fieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD] ? (
                                    <ErrorMessage>
                                      {
                                        fieldErrors[
                                          ID_DOCUMENT_UPLOAD_NOW_FIELD
                                        ]
                                      }
                                    </ErrorMessage>
                                  ) : null}
                                </Field>
                              </FieldGroup>
                            </Fieldset>

                            {uploadNowSelection === "yes" &&
                            shouldAskIdentityDocumentKind ? (
                              <Fieldset className="mt-6">
                                <FieldGroup>
                                  <Field>
                                    <Label>
                                      <Trans>
                                        Which document are you uploading?
                                      </Trans>
                                    </Label>
                                    <Description>
                                      <Trans>
                                        For German nationals, you can provide
                                        either identity card or passport.
                                      </Trans>
                                    </Description>
                                    <Select
                                      aria-label={_(
                                        msg`Which document are you uploading?`
                                      )}
                                      value={identityDocumentKind ?? ""}
                                      onChange={(event) => {
                                        const nextKind =
                                          event.target.value === "id_card" ||
                                          event.target.value === "passport"
                                            ? event.target.value
                                            : null;
                                        setIdentityDocumentKind(nextKind);
                                        setFormData((currentFormData) => ({
                                          ...currentFormData,
                                          [ID_DOCUMENT_KIND_FIELD]:
                                            nextKind ?? "",
                                        }));
                                      }}
                                    >
                                      <option value="">
                                        {_(msg`Select an option`)}
                                      </option>
                                      <option value="id_card">
                                        {_(msg`Identity card`)}
                                      </option>
                                      <option value="passport">
                                        {_(msg`Passport`)}
                                      </option>
                                    </Select>
                                  </Field>
                                </FieldGroup>
                              </Fieldset>
                            ) : null}

                            {uploadNowSelection === "no" ? (
                              <Text className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                                <Trans>
                                  You can continue now and upload your documents
                                  later.
                                </Trans>
                                <br />
                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                  <Trans>
                                    HR will still require these documents for
                                    the Bewacherregister registration.
                                  </Trans>
                                </span>
                              </Text>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  {stepUploadDocumentType &&
                  uploadNowSelection === "yes" &&
                  (!shouldAskIdentityDocumentKind ||
                    identityDocumentKind !== null) ? (
                    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <Heading level={3} className="mb-3">
                        <Trans>Identity Document Upload</Trans>
                      </Heading>
                      <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {identityDocumentKind === "id_card" ? (
                          <Trans>
                            Please upload your identity card (PDF, JPG, JPEG,
                            PNG; max. 10 MB).
                          </Trans>
                        ) : identityDocumentKind === "passport" ||
                          primaryNationalityCode !== "DE" ? (
                          <Trans>
                            Please upload your passport (PDF, JPG, JPEG, PNG;
                            max. 10 MB).
                          </Trans>
                        ) : (
                          <Trans>
                            Please upload your identity card or passport (PDF,
                            JPG, JPEG, PNG; max. 10 MB).
                          </Trans>
                        )}
                      </Text>
                      <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <Text className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          <Trans>Required documents for this step</Trans>
                        </Text>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                          <li>
                            {identityDocumentKind === "id_card" ? (
                              <Trans>Identity card</Trans>
                            ) : identityDocumentKind === "passport" ||
                              primaryNationalityCode !== "DE" ? (
                              <Trans>Passport</Trans>
                            ) : (
                              <Trans>Identity card or passport</Trans>
                            )}
                          </li>
                          <li>
                            <Trans>
                              For identity cards, upload front and back as
                              separate files
                            </Trans>
                          </li>
                          <li>
                            <Trans>
                              Proof of residence registration
                              (Meldebestätigung), only if your ID does not show
                              your current address
                            </Trans>
                          </li>
                        </ul>
                      </div>

                      {!submission ? (
                        <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                          <Trans>
                            Your current answers will be saved as a draft before
                            the first file upload.
                          </Trans>
                        </Text>
                      ) : null}

                      {uploadFeedback ? (
                        <div
                          role={
                            uploadFeedback.tone === "error" ? "alert" : "status"
                          }
                          aria-live={
                            uploadFeedback.tone === "error"
                              ? "assertive"
                              : "polite"
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
                              <Field>
                                <Label>
                                  <Trans>Attachment</Trans>
                                </Label>
                                <Description>
                                  <Trans>
                                    Accepted formats: PDF, JPG, JPEG, PNG.
                                  </Trans>
                                </Description>
                                <input
                                  ref={fileInputRef}
                                  aria-label={_(msg`Attachment`)}
                                  accept={ONBOARDING_UPLOAD_ACCEPT}
                                  className="block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:border-white/10 dark:bg-white/5 dark:text-white dark:file:bg-white/10 dark:file:text-white"
                                  type="file"
                                  onChange={(event) => {
                                    const nextPrimaryFile =
                                      event.target.files?.[0] ?? null;
                                    setUploadContext(
                                      nextPrimaryFile
                                        ? "identity_document"
                                        : null
                                    );
                                    setUploadFiles((currentFiles) =>
                                      nextPrimaryFile
                                        ? [
                                            nextPrimaryFile,
                                            ...(currentFiles[1]
                                              ? [currentFiles[1]]
                                              : []),
                                          ]
                                        : []
                                    );
                                  }}
                                />
                              </Field>

                              {uploadFiles[0] ? (
                                <Field>
                                  <Label>
                                    <Trans>
                                      Attachment (optional second file)
                                    </Trans>
                                  </Label>
                                  <Description>
                                    <Trans>
                                      Optional: Upload a second file, for
                                      example the reverse side.
                                    </Trans>
                                  </Description>
                                  <input
                                    aria-label={_(
                                      msg`Attachment (optional second file)`
                                    )}
                                    accept={ONBOARDING_UPLOAD_ACCEPT}
                                    className="block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:border-white/10 dark:bg-white/5 dark:text-white dark:file:bg-white/10 dark:file:text-white"
                                    type="file"
                                    onChange={(event) => {
                                      const nextSecondaryFile =
                                        event.target.files?.[0] ?? null;
                                      setUploadFiles((currentFiles) =>
                                        currentFiles[0]
                                          ? [
                                              currentFiles[0],
                                              ...(nextSecondaryFile
                                                ? [nextSecondaryFile]
                                                : []),
                                            ]
                                          : []
                                      );
                                    }}
                                  />
                                </Field>
                              ) : null}
                            </FieldGroup>
                          </Fieldset>

                          <div className="mt-4 flex items-center gap-4">
                            <Button
                              disabled={
                                uploadFiles.length === 0 || saving || uploading
                              }
                              onClick={() =>
                                void handleUpload("identity_document")
                              }
                            >
                              {uploading ? (
                                <Trans>Uploading...</Trans>
                              ) : (
                                <Trans>Upload File</Trans>
                              )}
                            </Button>
                            {uploadFiles.length > 0 ? (
                              <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                {uploadFiles
                                  .map((file) => file.name)
                                  .join(", ")}
                              </Text>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                          <Trans>
                            Files can only be uploaded while this onboarding
                            step is still editable.
                          </Trans>
                        </Text>
                      )}
                    </div>
                  ) : null}

                  {isIdentityUploadSectionCompleted &&
                  isOnboardingFieldVisible(
                    RESIDENCE_TITLE_TYPE_FIELD,
                    formData,
                    schema
                  ) ? (
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
                            {getResidenceTitleOptionLabel(option, i18n.locale)}
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
                  {areResidenceTitleFollowupFieldsUnlocked &&
                  isOnboardingFieldVisible(
                    RESIDENCE_TITLE_EXPIRY_FIELD,
                    formData,
                    schema
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
                        onBlur={(event) =>
                          handleFieldChange(
                            RESIDENCE_TITLE_EXPIRY_FIELD,
                            event.target.value,
                            { forceExpiryBusinessRules: true }
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
                  {shouldAskEmploymentQuestion &&
                  isOnboardingFieldVisible(
                    RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
                    formData,
                    schema
                  ) ? (
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
                      <RadioGroup
                        aria-label={_(msg`Employment permitted`)}
                        disabled={!isCurrentStepEditable}
                        value={getTextValue(
                          formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                        )}
                        onChange={(value) => {
                          if (value === "yes" || value === "no") {
                            handleFieldChange(
                              RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
                              value
                            );
                          }
                        }}
                        className="mt-3"
                      >
                        <RadioField>
                          <Radio value="yes" />
                          <Label>{_(msg`Yes`)}</Label>
                        </RadioField>
                        <RadioField>
                          <Radio value="no" />
                          <Label>{_(msg`No`)}</Label>
                        </RadioField>
                      </RadioGroup>
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
                  {isIdentityUploadSectionCompleted &&
                  shouldAskResidenceTitleUploadNow ? (
                    <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                      <Fieldset>
                        <FieldGroup>
                          <Field>
                            <Label>
                              <Trans>
                                Would you like to upload your residence title
                                now?
                              </Trans>
                            </Label>
                            <Description>
                              <Trans>
                                You can upload now or continue and add this
                                document later before final submission.
                              </Trans>
                            </Description>
                            <RadioGroup
                              aria-label={_(
                                msg`Would you like to upload your residence title now?`
                              )}
                              value={residenceTitleUploadNowSelection ?? ""}
                              onChange={(value) => {
                                if (value === "yes") {
                                  setResidenceTitleUploadNowSelection("yes");
                                  clearUploadRequirementErrors();
                                  setFormData((currentFormData) => ({
                                    ...currentFormData,
                                    [RESIDENCE_TITLE_UPLOAD_NOW_FIELD]: "yes",
                                  }));
                                  return;
                                }

                                if (value === "no") {
                                  setResidenceTitleUploadNowSelection("no");
                                  setUploadFiles([]);
                                  setUploadContext(null);
                                  clearUploadRequirementErrors();
                                  setFormData((currentFormData) => ({
                                    ...currentFormData,
                                    [RESIDENCE_TITLE_UPLOAD_NOW_FIELD]: "no",
                                  }));
                                }
                              }}
                              className="mt-3"
                            >
                              <RadioField>
                                <Radio value="yes" />
                                <Label>{_(msg`Yes`)}</Label>
                              </RadioField>
                              <RadioField>
                                <Radio value="no" />
                                <Label>{_(msg`No`)}</Label>
                              </RadioField>
                            </RadioGroup>
                            {fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD] ? (
                              <ErrorMessage>
                                {fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]}
                              </ErrorMessage>
                            ) : null}
                          </Field>
                        </FieldGroup>
                      </Fieldset>

                      {residenceTitleUploadNowSelection === "yes" ? (
                        <div className="mt-6">
                          <Heading level={3} className="mb-3">
                            <Trans>Residence Title Upload</Trans>
                          </Heading>
                          <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <Trans>
                              Please upload your residence title (PDF, JPG,
                              JPEG, PNG; max. 10 MB).
                            </Trans>
                          </Text>
                          <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <Trans>
                              Upload front and back as separate files if
                              available.
                            </Trans>
                          </Text>

                          {isCurrentStepEditable ? (
                            <>
                              <Fieldset>
                                <FieldGroup>
                                  <Field>
                                    <Label>
                                      <Trans>Attachment</Trans>
                                    </Label>
                                    <Description>
                                      <Trans>
                                        Accepted formats: PDF, JPG, JPEG, PNG.
                                      </Trans>
                                    </Description>
                                    <input
                                      aria-label={_(msg`Attachment`)}
                                      accept={ONBOARDING_UPLOAD_ACCEPT}
                                      className="block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:border-white/10 dark:bg-white/5 dark:text-white dark:file:bg-white/10 dark:file:text-white"
                                      type="file"
                                      onChange={(event) => {
                                        const nextPrimaryFile =
                                          event.target.files?.[0] ?? null;
                                        setUploadContext(
                                          nextPrimaryFile
                                            ? "residence_permit"
                                            : null
                                        );
                                        setUploadFiles((currentFiles) =>
                                          nextPrimaryFile
                                            ? [
                                                nextPrimaryFile,
                                                ...(currentFiles[1]
                                                  ? [currentFiles[1]]
                                                  : []),
                                              ]
                                            : []
                                        );
                                      }}
                                    />
                                  </Field>

                                  {uploadFiles[0] ? (
                                    <Field>
                                      <Label>
                                        <Trans>
                                          Attachment (optional second file)
                                        </Trans>
                                      </Label>
                                      <Description>
                                        <Trans>
                                          Optional: Upload the reverse side as a
                                          second file.
                                        </Trans>
                                      </Description>
                                      <input
                                        aria-label={_(
                                          msg`Attachment (optional second file)`
                                        )}
                                        accept={ONBOARDING_UPLOAD_ACCEPT}
                                        className="block w-full rounded-lg border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:border-white/10 dark:bg-white/5 dark:text-white dark:file:bg-white/10 dark:file:text-white"
                                        type="file"
                                        onChange={(event) => {
                                          const nextSecondaryFile =
                                            event.target.files?.[0] ?? null;
                                          setUploadFiles((currentFiles) =>
                                            currentFiles[0]
                                              ? [
                                                  currentFiles[0],
                                                  ...(nextSecondaryFile
                                                    ? [nextSecondaryFile]
                                                    : []),
                                                ]
                                              : []
                                          );
                                        }}
                                      />
                                    </Field>
                                  ) : null}
                                </FieldGroup>
                              </Fieldset>
                              <div className="mt-4 flex items-center gap-4">
                                <Button
                                  disabled={
                                    uploadFiles.length === 0 ||
                                    saving ||
                                    uploading
                                  }
                                  onClick={() =>
                                    void handleUpload("residence_permit")
                                  }
                                >
                                  {uploading ? (
                                    <Trans>Uploading...</Trans>
                                  ) : (
                                    <Trans>Upload File</Trans>
                                  )}
                                </Button>
                                {uploadFiles.length > 0 ? (
                                  <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {uploadFiles
                                      .map((file) => file.name)
                                      .join(", ")}
                                  </Text>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                              <Trans>
                                Files can only be uploaded while this onboarding
                                step is still editable.
                              </Trans>
                            </Text>
                          )}
                        </div>
                      ) : null}
                    </div>
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

            {stepUploadDocumentType && uploadedFiles.length > 0 ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
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
                        {uploadedFile.documentType === "contract"
                          ? _(msg`Contract`)
                          : uploadedFile.documentType === "id_document"
                            ? uploadedFile.documentSubtype
                              ? getIdDocumentSubtypeLabel(
                                  uploadedFile.documentSubtype,
                                  i18n.locale,
                                  primaryNationalityCode,
                                  identityDocumentKind
                                )
                              : _(msg`Identity Document`)
                            : _(msg`Banking Details`)}
                      </span>
                      <span className="ml-2 text-zinc-500 dark:text-zinc-400">
                        {uploadedFile.filename}
                      </span>
                      <div className="mt-2">
                        <Button
                          outline
                          onClick={() =>
                            void handleRemoveUploadedFile(uploadedFile.id)
                          }
                          disabled={saving || uploading}
                        >
                          <Trans>Remove</Trans>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

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
              canGoNext={
                !saving &&
                !uploading &&
                uploadFiles.length === 0 &&
                !isEmploymentHardBlocked
              }
              isBusy={saving || uploading}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
