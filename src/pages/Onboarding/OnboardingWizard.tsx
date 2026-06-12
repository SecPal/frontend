// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { getLocalizedErrorMessage } from "../../lib/errorUtils";
import {
  getAuthOnboardingWorkflowStatus,
  isSubmittedOnboardingWorkflowStatus,
} from "../../lib/onboardingWorkflow";
import { AuthContext } from "../../contexts/auth-context";
import { getAuthTransport } from "../../services/authTransport";
import {
  getOnboardingStepState,
  isOnboardingAwaitingHrReview,
} from "./onboardingWizardState";
import { FormSkeleton, Skeleton } from "@/ui";
import {
  OnboardingResidentialAddressHistoryFields,
  type ResidentialAddressHistoryChange,
} from "./OnboardingResidentialAddressHistoryFields";
import {
  getResidentialAddressHistoryValue,
  validateResidentialAddressHistoryValue,
} from "./onboardingResidentialAddressHistory";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox as UiCheckbox,
  CommandPopover,
  Field as UiField,
  FieldDescription as UiFieldDescription,
  FieldError as UiFieldError,
  FieldGroup as UiFieldGroup,
  FieldLabel as UiFieldLabel,
  Input as UiInput,
  Progress,
  RadioGroup as UiRadioGroup,
  RadioGroupItem as UiRadioGroupItem,
  Select as UiSelect,
  Textarea as UiTextarea,
} from "./ui";

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
const RESIDENTIAL_ADDRESS_HISTORY_TEMPLATE_KEY = "residential_address_history";
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

function isResidentialAddressHistoryTemplate(
  template: OnboardingFormTemplate | null
): boolean {
  return template?.template_key === RESIDENTIAL_ADDRESS_HISTORY_TEMPLATE_KEY;
}

function isResidentialAddressHistoryFieldKey(fieldKey: string): boolean {
  // Bare aggregate keys like "current_address" or "previous_addresses" are not
  // rendered as inline errors by the component; only nested keys with a dot
  // separator or the specific Bewacher fields are handled inline.
  return (
    fieldKey.startsWith("current_address.") ||
    fieldKey.startsWith("previous_addresses.") ||
    fieldKey === "has_current_bewacher_id" ||
    fieldKey === "bewacher_id" ||
    fieldKey === "bewacher_id_unknown"
  );
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

/**
 * Laravel often returns whole-form messages under `errors.form_data`; those are
 * not tied to a schema field named "form_data", so we avoid the misleading
 * "form_data: …" prefix and map known API phrases to clearer copy.
 */
function mapKnownWholeFormOnboardingApiError(
  message: string,
  translate: ReturnType<typeof useLingui>["_"]
): string | null {
  const normalized = message.trim();
  if (
    /onboarding workflow is not in an expected state/i.test(normalized) ||
    (/cannot submit/i.test(normalized) &&
      /onboarding workflow/i.test(normalized))
  ) {
    return translate(
      msg`The save failed on the server because your onboarding workflow is not currently editable. The wizard will refresh to the latest server state.`
    );
  }
  return null;
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
  if (fieldKey === "form_data" && label === "form_data") {
    return message;
  }

  return message.startsWith(`${label}:`) ? message : `${label}: ${message}`;
}

function formatSupplementalValidationMessage(
  message: string,
  schema: OnboardingObjectSchema | null,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  const mapped = mapKnownWholeFormOnboardingApiError(message, translate);
  if (mapped) {
    return mapped;
  }
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

function getFirstActionableStepIndex(steps: OnboardingStep[]): number {
  const index = steps.findIndex(
    (step) =>
      step.submission == null ||
      step.submission.status === "draft" ||
      step.submission.status === "rejected"
  );

  return index >= 0 ? index : 0;
}

function isWorkflowConflictError(error: unknown): error is ApiError {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if (error.statusCode !== 409 && error.statusCode !== 422) {
    return false;
  }

  const validationMessages = [
    ...(error.errors?.onboarding_workflow_status ?? []),
    ...(error.errors?.form_data ?? []),
  ].filter((entry) => entry.trim().length > 0);

  if (validationMessages.length > 0) {
    return validationMessages.every((entry) =>
      /onboarding workflow/i.test(entry)
    );
  }

  // For 422s Laravel returns a generic "The given data was invalid." message
  // that never matches the workflow pattern; only use the message fallback for
  // 409 Conflict responses which carry a specific conflict description.
  if (error.statusCode !== 409) {
    return false;
  }

  return /onboarding workflow/i.test(error.message);
}

function ProgressIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  const { _ } = useLingui();
  const percentage = (currentStep / totalSteps) * 100;
  const roundedPercentage = Math.round(percentage);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <span>
          <Trans>
            Step {currentStep} of {totalSteps}
          </Trans>
        </span>
        <span>{roundedPercentage}%</span>
      </div>
      <Progress
        value={roundedPercentage}
        aria-label={_(msg`Onboarding progress`)}
      />
    </div>
  );
}

function OnboardingWizardFrame({
  steps,
  currentStepIndex,
  children,
}: {
  steps: OnboardingStep[];
  currentStepIndex: number;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
        <CardHeader>
          <CardTitle>
            <Trans>Welcome to SecPal Onboarding</Trans>
          </CardTitle>
          {steps.length > 0 ? (
            <ProgressIndicator
              currentStep={currentStepIndex + 1}
              totalSteps={steps.length}
            />
          ) : (
            <div className="space-y-2" aria-hidden="true">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </section>
    </div>
  );
}

function OnboardingWizardLoadingContent({
  loadingLabel,
}: {
  loadingLabel: string;
}) {
  return (
    <div className="space-y-6">
      <div
        aria-hidden="true"
        className="mb-4 flex flex-wrap items-center gap-3"
      >
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-6 w-20" />
      </div>
      <FormSkeleton loadingLabel={loadingLabel} fields={5} />
    </div>
  );
}

function RequiredMarker({ show }: { show: boolean }) {
  return show ? <span aria-hidden="true"> *</span> : null;
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
  const safeFieldId = fieldName.replace(/[^A-Za-z0-9_-]/g, "-");
  const fieldId = `onboarding-field-${safeFieldId}`;
  const descriptionId = property.description
    ? `${fieldId}-description`
    : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const ariaDescribedBy = describedBy.length > 0 ? describedBy : undefined;

  if (property.type === "string") {
    const options = getSchemaOptions(property);

    return (
      <UiField>
        <UiFieldLabel htmlFor={fieldId}>
          {title}
          <RequiredMarker show={showRequiredMarker} />
        </UiFieldLabel>
        {property.description ? (
          <UiFieldDescription id={descriptionId}>
            {property.description}
          </UiFieldDescription>
        ) : null}
        {options.length > 0 ? (
          <UiSelect
            id={fieldId}
            aria-label={title}
            aria-describedby={ariaDescribedBy}
            aria-invalid={Boolean(error) || undefined}
            disabled={readOnly}
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
          </UiSelect>
        ) : (
          <UiInput
            id={fieldId}
            aria-label={title}
            aria-describedby={ariaDescribedBy}
            aria-invalid={Boolean(error) || undefined}
            disabled={readOnly}
            name={fieldName}
            pattern={property.pattern}
            required={fieldRequired}
            value={getTextValue(formData[fieldName])}
            maxLength={property.maxLength}
            onChange={(event) => onChange(fieldName, event.target.value)}
          />
        )}
        {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
      </UiField>
    );
  }

  if (property.type === "integer" || property.type === "number") {
    const options = getSchemaOptions(property);

    return (
      <UiField>
        <UiFieldLabel htmlFor={fieldId}>
          {title}
          <RequiredMarker show={showRequiredMarker} />
        </UiFieldLabel>
        {property.description ? (
          <UiFieldDescription id={descriptionId}>
            {property.description}
          </UiFieldDescription>
        ) : null}
        {options.length > 0 ? (
          <UiSelect
            id={fieldId}
            aria-label={title}
            aria-describedby={ariaDescribedBy}
            aria-invalid={Boolean(error) || undefined}
            disabled={readOnly}
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
          </UiSelect>
        ) : (
          <UiInput
            id={fieldId}
            aria-label={title}
            aria-describedby={ariaDescribedBy}
            aria-invalid={Boolean(error) || undefined}
            disabled={readOnly}
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
        {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
      </UiField>
    );
  }

  if (property.type === "boolean") {
    return (
      <UiField className="space-y-2">
        <div className="flex items-center gap-3">
          <UiCheckbox
            id={fieldId}
            aria-label={title}
            aria-describedby={ariaDescribedBy}
            aria-invalid={Boolean(error) || undefined}
            checked={getBooleanValue(formData[fieldName])}
            disabled={readOnly}
            required={fieldRequired}
            onChange={(event) => onChange(fieldName, event.target.checked)}
          />
          <UiFieldLabel htmlFor={fieldId}>
            {title}
            <RequiredMarker show={showRequiredMarker} />
          </UiFieldLabel>
        </div>
        {property.description ? (
          <UiFieldDescription id={descriptionId}>
            {property.description}
          </UiFieldDescription>
        ) : null}
        {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
      </UiField>
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
        <UiField>
          <UiFieldLabel htmlFor={fieldId}>
            {title}
            <RequiredMarker show={showRequiredMarker} />
          </UiFieldLabel>
          <UiFieldDescription id={descriptionId ?? `${fieldId}-description`}>
            <Trans>
              Nationality options could not be loaded right now. Please reload
              this page and try again.
            </Trans>
          </UiFieldDescription>
          <UiSelect
            id={fieldId}
            aria-label={title}
            aria-describedby={
              [descriptionId ?? `${fieldId}-description`, errorId]
                .filter(Boolean)
                .join(" ") || undefined
            }
            aria-invalid={Boolean(error) || undefined}
            disabled
            name={fieldName}
            required={fieldRequired}
            value=""
            onChange={() => {}}
          >
            <option value="">{_(msg`Select an option`)}</option>
          </UiSelect>
          {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
        </UiField>
      );
    }

    if (itemOptions.length > 0) {
      if (fieldName === "nationalities") {
        const nationalityOptions = itemOptions.map((option) => ({
          value: String(option.value),
          label: option.label,
        }));
        const selectedValue = selectedValues[0] ?? "";

        return (
          <UiField>
            <CommandPopover
              label={title}
              options={nationalityOptions}
              value={selectedValue}
              disabled={readOnly}
              placeholder={_(msg`Select an option`)}
              searchPlaceholder={_(msg`Search and select one nationality.`)}
              emptyMessage={_(msg`No results found`)}
              errorMessage={error}
              onValueChange={(value) =>
                onChange(fieldName, value.length > 0 ? [value] : [])
              }
            />
            <UiFieldDescription id={descriptionId ?? `${fieldId}-description`}>
              {_(msg`Search and select one nationality.`)}
            </UiFieldDescription>
          </UiField>
        );
      }

      return (
        <UiField>
          <div
            role="group"
            aria-labelledby={`${fieldId}-label`}
            aria-describedby={ariaDescribedBy}
          >
            <div className="space-y-2">
              <div>
                <span
                  id={`${fieldId}-label`}
                  className="text-sm font-medium text-zinc-950 dark:text-zinc-50"
                >
                  {title}
                  <RequiredMarker show={showRequiredMarker} />
                </span>
              </div>
              {property.description ? (
                <UiFieldDescription id={descriptionId}>
                  {property.description}
                </UiFieldDescription>
              ) : null}
              <div className="space-y-3">
                {itemOptions.map((option) => {
                  const optionValue = String(option.value);
                  const optionId = `${fieldId}-${optionValue.replace(
                    /[^A-Za-z0-9_-]/g,
                    "-"
                  )}`;

                  return (
                    <div key={optionValue} className="flex items-center gap-3">
                      <UiCheckbox
                        id={optionId}
                        checked={selectedValues.includes(optionValue)}
                        disabled={readOnly}
                        onChange={(event) => {
                          const nextValues = event.target.checked
                            ? [...selectedValues, optionValue]
                            : selectedValues.filter(
                                (entry) => entry !== optionValue
                              );

                          onChange(fieldName, nextValues);
                        }}
                      />
                      <UiFieldLabel htmlFor={optionId}>
                        {option.label}
                      </UiFieldLabel>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
        </UiField>
      );
    }

    return (
      <UiField>
        <UiFieldLabel htmlFor={fieldId}>
          {title}
          <RequiredMarker show={showRequiredMarker} />
        </UiFieldLabel>
        <UiFieldDescription id={descriptionId ?? `${fieldId}-description`}>
          {property.description ?? _(msg`Enter one value per line.`)}
        </UiFieldDescription>
        <UiTextarea
          id={fieldId}
          aria-label={title}
          aria-describedby={
            [descriptionId ?? `${fieldId}-description`, errorId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={Boolean(error) || undefined}
          disabled={readOnly}
          name={fieldName}
          required={fieldRequired}
          rows={4}
          value={getArrayTextareaValue(formData[fieldName])}
          onChange={(event) =>
            onChange(fieldName, parseArrayTextareaValue(event.target.value))
          }
        />
        {error ? <UiFieldError id={errorId}>{error}</UiFieldError> : null}
      </UiField>
    );
  }

  return null;
}

function OnboardingStepsOverview({ steps }: { steps: OnboardingStep[] }) {
  const { _ } = useLingui();
  const requiredSteps = steps.filter((step) => step.is_required);
  const optionalSteps = steps.filter((step) => !step.is_required);

  return (
    <Card className="mb-8 bg-zinc-50 shadow-none dark:bg-zinc-950/40">
      <CardHeader>
        <CardTitle>
          <Trans>Before you begin</Trans>
        </CardTitle>
        <CardDescription>
          <Trans>
            Here is what the onboarding wizard will ask for. Required sections
            must be completed; optional sections can be skipped when empty.
          </Trans>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {requiredSteps.length > 0 ? (
          <section aria-label={_(msg`Required information`)}>
            <div className="mb-2 flex items-center gap-2">
              <Badge>
                <Trans>Required information</Trans>
              </Badge>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {requiredSteps.map((step) => (
                <li key={step.template_id}>
                  {_(msg`Step ${step.step_number}: ${step.title}`)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {optionalSteps.length > 0 ? (
          <section aria-label={_(msg`Optional sections`)}>
            <div className="mb-2 flex items-center gap-2">
              <Badge className="bg-white dark:bg-zinc-900">
                <Trans>Optional sections</Trans>
              </Badge>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {optionalSteps.map((step) => (
                <li key={step.template_id}>
                  {_(msg`Step ${step.step_number}: ${step.title}`)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <div className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Trans>Supporting documents</Trans>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <Trans>
              Document uploads are only shown where a specific document is
              required for the current onboarding step.
            </Trans>
          </p>
        </section>
      </CardContent>
    </Card>
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
  const { _ } = useLingui();
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <CardFooter
      role="navigation"
      aria-label={_(msg`Onboarding step navigation`)}
      className="mt-8 flex-col items-stretch justify-between gap-3 border-t border-zinc-200 p-0 pt-6 sm:flex-row sm:items-center dark:border-zinc-800"
    >
      <div>
        {!isFirstStep && (
          <Button disabled={isBusy} onClick={onPrevious} variant="outline">
            <Trans>Previous</Trans>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4">
        {isStepEditable ? (
          <Button disabled={isBusy} onClick={onSaveDraft} variant="outline">
            <Trans>Save Draft</Trans>
          </Button>
        ) : null}

        {showSkipStep && onSkipStep && !isLastStep && isStepEditable ? (
          <Button disabled={isBusy} onClick={onSkipStep} variant="outline">
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
    </CardFooter>
  );
}

export function OnboardingWizard() {
  const { _, i18n } = useLingui();
  const authContext = useContext(AuthContext);
  const authTransport = useMemo(() => getAuthTransport(), []);
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
  const [templateResetKey, setTemplateResetKey] = useState(0);
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
  const [apiValidationDetailMessages, setApiValidationDetailMessages] =
    useState<string[]>([]);
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
  const feedbackErrorRef = useRef<HTMLDivElement | null>(null);
  const currentStepIndexRef = useRef(0);
  const templateCacheRef = useRef<Map<string, OnboardingFormTemplate>>(
    new Map()
  );
  const currentStepTemplateId = steps[currentStepIndex]?.template_id;
  const schema = template ? getObjectSchema(template.form_schema) : null;
  const contractStartDateFromAuth =
    authContext?.user?.employee?.contract_start_date ?? null;
  const employeeIdFromAuth = authContext?.user?.employee?.id ?? null;
  const currentOnboardingWorkflowStatus = getAuthOnboardingWorkflowStatus(
    authContext?.user
  );
  const employeeIdFromSteps = useMemo(
    () => getEmployeeIdFromSteps(steps),
    [steps]
  );
  const employeeIdForContractStartLookup =
    employeeIdFromSteps ?? employeeIdFromAuth;
  const contractStartDateFromOtherSteps = getContractStartDateFromSteps(steps);
  const hasValidAuthContractStart =
    typeof contractStartDateFromAuth === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(contractStartDateFromAuth);
  const hasValidFetchedEmployeeContractStart =
    typeof employeeContractStartDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(employeeContractStartDate);
  const contractStartDateFallback = hasValidAuthContractStart
    ? contractStartDateFromAuth
    : hasValidFetchedEmployeeContractStart
      ? employeeContractStartDate
      : (contractStartDateFromOtherSteps ?? contractStartDateFromAuth);
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
  const isCurrentStepEditable =
    isEditableSubmission(submission) &&
    !isSubmittedOnboardingWorkflowStatus(currentOnboardingWorkflowStatus);

  const syncAuthenticatedUser = useCallback(async () => {
    if (!authContext) {
      return null;
    }

    try {
      const refreshedUser = await authTransport.getCurrentUser();
      await authContext.login(refreshedUser);
      return refreshedUser;
    } catch {
      authContext.retryBootstrap();
      return null;
    }
  }, [authContext, authTransport]);

  const applyLoadedSteps = useCallback(
    (data: OnboardingStep[], preferredStepIndex = 0) => {
      setError(null);
      setSteps(data);

      if (isOnboardingAwaitingHrReview(data)) {
        setLoading(false);
        navigate("/onboarding/submitted", { replace: true });
        return;
      }

      setLoading(data.length > 0);
      const boundedStepIndex =
        preferredStepIndex >= 0 && preferredStepIndex < data.length
          ? preferredStepIndex
          : 0;
      const nextIndex = data.length > 0 ? boundedStepIndex : 0;
      const stepState = getOnboardingStepState(data[nextIndex]);
      setCurrentStepIndex(nextIndex);
      setSubmission(stepState.submission);
      setFormData(stepState.formData);
      setTemplate(null);
      setTemplateResetKey((k) => k + 1);
    },
    [navigate]
  );

  const resetUploadState = useCallback(() => {
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
  }, []);

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

  const handleWorkflowConflict = useCallback(async () => {
    setLoading(true);
    const refreshedUser = await syncAuthenticatedUser();
    const refreshedStatus = getAuthOnboardingWorkflowStatus(
      refreshedUser ?? authContext?.user
    );

    if (isSubmittedOnboardingWorkflowStatus(refreshedStatus)) {
      setLoading(false);
      navigate("/onboarding/submitted", { replace: true });
      return;
    }

    try {
      const data = await fetchOnboardingSteps();
      resetUploadState();
      setFieldErrors({});
      setApiValidationDetailMessages([]);
      setFeedback({
        tone: "error",
        message: _(
          msg`Your onboarding state changed on the server while you were editing. The wizard was refreshed to the current server state.`
        ),
      });
      applyLoadedSteps(data, getFirstActionableStepIndex(data));
    } catch (err) {
      setError(
        getLocalizedErrorMessage(err, _, {
          fallback: msg`Failed to reload onboarding after a workflow state change`,
        })
      );
      setLoading(false);
    }
  }, [
    _,
    authContext?.user,
    applyLoadedSteps,
    navigate,
    resetUploadState,
    syncAuthenticatedUser,
  ]);

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

    if (hasAuthContractStartDate || !employeeIdForContractStartLookup) {
      return;
    }

    let active = true;

    void fetchEmployee(employeeIdForContractStartLookup)
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
  }, [employeeIdForContractStartLookup, contractStartDateFromAuth]);

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

    const errorElement =
      feedback?.tone === "error"
        ? (feedbackErrorRef.current ?? onboardingErrorRef.current)
        : onboardingErrorRef.current;
    if (!errorElement) {
      return;
    }

    if (typeof errorElement.scrollIntoView === "function") {
      errorElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    errorElement.focus({ preventScroll: true });
  }, [feedback, error, currentStepIndex]);

  useEffect(() => {
    if (!isSubmittedOnboardingWorkflowStatus(currentOnboardingWorkflowStatus)) {
      return;
    }

    navigate("/onboarding/submitted", { replace: true });
  }, [currentOnboardingWorkflowStatus, navigate]);

  useEffect(() => {
    let active = true;

    // Do not depend on `currentOnboardingWorkflowStatus` for this fetch: `persistCurrentStep`
    // calls `syncAuthenticatedUser()`, which updates workflow in auth state. Re-running this
    // effect would reset the wizard to step 0 after each draft save. Submitted users are
    // redirected by the separate workflow-status effect above.

    void fetchOnboardingSteps()
      .then((data) => {
        if (!active) {
          return;
        }

        setFeedback(null);
        applyLoadedSteps(data, 0);
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
  }, [applyLoadedSteps]);

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
  }, [currentStepIndex, currentStepTemplateId, templateResetKey]);

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

  async function resolveStepValidationContext(
    step: OnboardingStep | undefined
  ): Promise<{
    template: OnboardingFormTemplate | null;
    schema: OnboardingObjectSchema | null;
  }> {
    if (!step) {
      return { template: null, schema: null };
    }

    // The active step's template is always pushed into `templateCacheRef`
    // when `useEffect` resolves it (see the cache.set near `setTemplate`),
    // so the cache lookup below also covers the "this is the current step"
    // case without an extra branch to test.
    const cachedTemplate = templateCacheRef.current.get(step.template_id);
    if (cachedTemplate) {
      return {
        template: cachedTemplate,
        schema: getObjectSchema(cachedTemplate.form_schema),
      };
    }

    try {
      const stepTemplate = await fetchOnboardingTemplate(step.template_id);
      templateCacheRef.current.set(step.template_id, stepTemplate);
      return {
        template: stepTemplate,
        schema: getObjectSchema(stepTemplate.form_schema),
      };
    } catch {
      return { template: null, schema: null };
    }
  }

  async function submitRequiredDraftSteps(): Promise<boolean> {
    const stepsToSubmit: Array<{
      index: number;
      submission: OnboardingSubmission;
      template: OnboardingFormTemplate | null;
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

      const { template: stepTemplate, schema: stepSchema } =
        await resolveStepValidationContext(step);

      stepsToSubmit.push({
        index,
        submission: step.submission,
        template: stepTemplate,
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
        template: stepTemplate,
        schema: stepSchema,
      } of stepsToSubmit) {
        failingStepIndex = index;
        const requiredFieldMessage = _(msg`This field is required.`);
        // The residential address history step is rendered by a custom UI and
        // serializes nested object/array data that the generic JSON-Schema
        // helpers below cannot validate (`current_address` is `type: "object"`
        // and would always look "empty" to `isRequiredFieldFilled`). Mirror the
        // per-step validator used in `validateCurrentStepRequiredFields` so
        // earlier-saved drafts pass the same check the user already cleared.
        const isResidentialHistoryStep =
          isResidentialAddressHistoryTemplate(stepTemplate);
        const rawStepFormData =
          (stepSubmission.form_data as Record<string, unknown> | null) ?? {};
        const stepFormData = isResidentialHistoryStep
          ? rawStepFormData
          : sanitizeEmployeeOnboardingFormData(rawStepFormData, stepSchema);

        let stepFieldErrors: FieldErrors;
        if (isResidentialHistoryStep) {
          stepFieldErrors = validateResidentialAddressHistoryValue(
            getResidentialAddressHistoryValue(stepFormData),
            _
          );
        } else {
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
          stepFieldErrors = {
            ...requiredFieldErrors,
            ...additionalRequiredFieldErrors,
            ...patternFieldErrors,
          };
        }

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
          setApiValidationDetailMessages([]);
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

      await syncAuthenticatedUser();
      return true;
    } catch (err) {
      let validationSchemaForMessage: OnboardingObjectSchema | null = schema;

      if (failingStepIndex !== null) {
        const failedStep = steps[failingStepIndex];
        const failedStepState = getOnboardingStepState(failedStep);
        const failedStepSchema = (
          await resolveStepValidationContext(failedStep)
        ).schema;
        if (failedStepSchema) {
          validationSchemaForMessage = failedStepSchema;
        }

        setLoading(true);
        setFeedback(null);
        setFieldErrors({});
        setApiValidationDetailMessages([]);
        resetUploadState();
        setTemplate(null);
        setSubmission(failedStepState.submission);
        setFormData(failedStepState.formData);
        setCurrentStepIndex(failingStepIndex);
      }

      if (isWorkflowConflictError(err)) {
        await handleWorkflowConflict();
        return false;
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
      setApiValidationDetailMessages([]);

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
      await syncAuthenticatedUser();
      return savedSubmission;
    } catch (err) {
      if (isWorkflowConflictError(err)) {
        await handleWorkflowConflict();
        return null;
      }

      if (err instanceof ApiError && err.statusCode === 422 && err.errors) {
        const nextFieldErrors: FieldErrors = {};
        let hiddenFieldValidationMessage: string | null = null;
        const extraServerMessages: string[] = [];

        function pushExtraServerMessage(text: string) {
          const t = text.trim();
          if (t.length > 0 && !extraServerMessages.includes(t)) {
            extraServerMessages.push(t);
          }
        }

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
          const fieldKey = isResidentialAddressHistoryTemplate(template)
            ? key.startsWith("form_data.")
              ? key.slice("form_data.".length)
              : key
            : getServerValidationFieldKey(key, schema);
          const first = messages[0];
          if (!first) {
            continue;
          }

          const isInlineFieldError = isResidentialAddressHistoryTemplate(
            template
          )
            ? isResidentialAddressHistoryFieldKey(fieldKey)
            : Boolean(schema?.properties[fieldKey]) &&
              isOnboardingFieldVisible(fieldKey, formData, schema);

          if (!isInlineFieldError) {
            const formattedHidden = formatServerValidationMessage(
              fieldKey,
              first,
              schema,
              _
            );
            hiddenFieldValidationMessage ??= formattedHidden;
            pushExtraServerMessage(formattedHidden);
            continue;
          }

          nextFieldErrors[fieldKey] = isResidentialAddressHistoryTemplate(
            template
          )
            ? first
            : formatServerValidationMessage(fieldKey, first, schema, _);
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
        if (hasInline && supplemental) {
          const inlineMessages = new Set(Object.values(nextFieldErrors));
          if (!inlineMessages.has(supplemental)) {
            pushExtraServerMessage(supplemental);
          }
        }
        const validationReviewMessage =
          status === "draft"
            ? _(
                msg`We couldn't save your draft yet. Please review the highlighted fields.`
              )
            : _(
                msg`We couldn't submit the form yet. Please review the highlighted fields.`
              );
        const fallbackValidationMessage =
          err.message.length > 0
            ? formatValidationFallbackMessage(err.message, schema, _)
            : null;
        const primaryBannerMessage = hasInline
          ? validationReviewMessage
          : supplemental
            ? supplemental
            : (fallbackValidationMessage ?? validationReviewMessage);
        setFeedback({
          tone: "error",
          message: primaryBannerMessage,
        });
        setApiValidationDetailMessages(
          extraServerMessages.filter(
            (m) => !(m === primaryBannerMessage && !hasInline)
          )
        );
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
    if (!isEditableSubmission(submission)) {
      return true;
    }

    if (!template) {
      return true;
    }

    if (isResidentialAddressHistoryTemplate(template)) {
      const nextFieldErrors = validateResidentialAddressHistoryValue(
        getResidentialAddressHistoryValue(formData),
        _
      );

      if (Object.keys(nextFieldErrors).length === 0) {
        return true;
      }

      setError(null);
      setFieldErrors(nextFieldErrors);
      setApiValidationDetailMessages([]);
      const errKeys = Object.keys(nextFieldErrors);
      const onlyBewacherChoiceMissing =
        errKeys.length === 1 && errKeys[0] === "has_current_bewacher_id";
      const onlyBewacherIdMissing =
        errKeys.length === 1 && errKeys[0] === "bewacher_id";
      const onlyCoverageMissing =
        errKeys.length === 1 && errKeys[0] === "previous_addresses.coverage";
      setFeedback({
        tone: "error",
        message: onlyBewacherChoiceMissing
          ? _(
              msg`Please answer whether you currently have a Bewacher ID (Yes / No) in the section below your address.`
            )
          : onlyBewacherIdMissing
            ? _(
                msg`Please enter your Bewacher ID or indicate that you do not know it.`
              )
            : onlyCoverageMissing
              ? _(
                  msg`Your residence history does not cover the required period yet. Add previous addresses or move your “Living there since” date further back.`
                )
              : _(
                  msg`We couldn't submit the form yet. Please review the highlighted fields.`
                ),
      });
      return false;
    }

    if (!schema) {
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
    setApiValidationDetailMessages([]);
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

    if (!validateCurrentStepRequiredFields()) {
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
      setApiValidationDetailMessages([]);
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
    setApiValidationDetailMessages([]);
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
      setApiValidationDetailMessages([]);
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

  const handleResidentialAddressHistoryChange = useCallback(
    (nextValueOrUpdater: ResidentialAddressHistoryChange) => {
      setFormData((currentFormData) => {
        const prevResidential =
          getResidentialAddressHistoryValue(currentFormData);
        const nextResidential =
          typeof nextValueOrUpdater === "function"
            ? nextValueOrUpdater(prevResidential)
            : nextValueOrUpdater;
        return {
          ...currentFormData,
          current_address: nextResidential.current_address,
          previous_addresses: nextResidential.previous_addresses,
          has_current_bewacher_id: nextResidential.has_current_bewacher_id,
          bewacher_id: nextResidential.bewacher_id,
          bewacher_id_unknown: nextResidential.bewacher_id_unknown,
        };
      });

      setFieldErrors((currentFieldErrors) =>
        Object.fromEntries(
          Object.entries(currentFieldErrors).filter(
            ([fieldKey]) => !isResidentialAddressHistoryFieldKey(fieldKey)
          )
        )
      );
    },
    []
  );

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
    await syncAuthenticatedUser();
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
      if (isWorkflowConflictError(err)) {
        await handleWorkflowConflict();
        return false;
      }

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
      if (isWorkflowConflictError(err)) {
        await handleWorkflowConflict();
        return;
      }

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
      <Alert
        role={entryFeedback.tone === "error" ? "alert" : "status"}
        className={
          entryFeedback.tone === "error"
            ? "mb-6 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
            : "mb-6 border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
        }
      >
        <AlertDescription
          className={
            entryFeedback.tone === "error"
              ? "text-red-800 dark:text-red-200"
              : "text-emerald-800 dark:text-emerald-200"
          }
        >
          {entryFeedback.message}
        </AlertDescription>
      </Alert>
    ) : null;
  const onboardingLoadingLabel = _(msg`Loading onboarding`);

  if (loading && (steps.length === 0 || template === null)) {
    return (
      <OnboardingWizardFrame steps={steps} currentStepIndex={currentStepIndex}>
        {entryFeedbackBanner}
        <OnboardingWizardLoadingContent loadingLabel={onboardingLoadingLabel} />
      </OnboardingWizardFrame>
    );
  }

  if (error && steps.length === 0) {
    return (
      <OnboardingWizardFrame
        steps={steps}
        currentStepIndex={currentStepIndex}
      >
        {entryFeedbackBanner}
        <Alert
          ref={onboardingErrorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
        >
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      </OnboardingWizardFrame>
    );
  }

  if (!template && steps.length === 0) {
    return (
      <Card className="mx-auto max-w-4xl">
        <CardContent className="p-6 text-sm text-zinc-600 dark:text-zinc-300">
          <Trans>No onboarding steps are available right now.</Trans>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
        <CardHeader>
          <CardTitle>
            <Trans>Welcome to SecPal Onboarding</Trans>
          </CardTitle>
          <ProgressIndicator
            currentStep={currentStepIndex + 1}
            totalSteps={steps.length}
          />
        </CardHeader>
        <CardContent>
          {entryFeedbackBanner}

          {feedback ? (
            <Alert
              ref={feedback.tone === "error" ? feedbackErrorRef : null}
              tabIndex={feedback.tone === "error" ? -1 : undefined}
              role={feedback.tone === "error" ? "alert" : "status"}
              aria-live={feedback.tone === "error" ? "assertive" : "polite"}
              aria-atomic="true"
              className={
                feedback.tone === "error"
                  ? "mb-6 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
                  : "mb-6 border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              }
            >
              <AlertDescription
                className={
                  feedback.tone === "error"
                    ? "text-red-800 dark:text-red-200"
                    : "text-emerald-800 dark:text-emerald-200"
                }
              >
                {feedback.message}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert
              ref={onboardingErrorRef}
              tabIndex={-1}
              role="alert"
              aria-live="assertive"
              className="mb-6 border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
            >
              <AlertDescription className="text-red-800 dark:text-red-200">
                {error}
              </AlertDescription>
            </Alert>
          ) : null}
          {apiValidationDetailMessages.length > 0 ? (
            <Alert
              role="region"
              aria-label={_(
                msg`Additional validation messages from the server`
              )}
              className="mb-6 border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900/40"
            >
              <div className="mb-2 font-medium text-zinc-900 dark:text-zinc-100">
                <Trans>Additional validation messages from the server</Trans>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-800 dark:text-zinc-200">
                {apiValidationDetailMessages.map((message, index) => (
                  <li key={`${index}-${message.slice(0, 48)}`}>{message}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

      {template && (
        <div>
          {currentStepIndex === 0 ? (
            <OnboardingStepsOverview steps={steps} />
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mb-0 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {template.title ?? template.name}
            </h2>
            {template.is_required === false ? (
              <Badge>
                <Trans>Optional</Trans>
              </Badge>
            ) : null}
          </div>

          {template.description ? (
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">
              {template.description}
            </p>
          ) : null}

          {isResidentialAddressHistoryTemplate(template) ? (
            <OnboardingResidentialAddressHistoryFields
              value={getResidentialAddressHistoryValue(formData)}
              errors={fieldErrors}
              readOnly={!isCurrentStepEditable}
              onChange={handleResidentialAddressHistoryChange}
            />
          ) : schema ? (
            <UiFieldGroup>
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
                      <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                        <UiFieldGroup>
                          <UiField>
                            <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                              <Trans>
                                Would you like to upload your identity document
                                now?
                              </Trans>
                            </div>
                            <UiFieldDescription>
                              <Trans>
                                You can upload now or continue and add documents
                                later before final submission.
                              </Trans>
                            </UiFieldDescription>
                            <UiRadioGroup
                              aria-label={_(
                                msg`Would you like to upload your identity document now?`
                              )}
                              aria-invalid={
                                fieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD]
                                  ? true
                                  : undefined
                              }
                              aria-describedby={
                                fieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD]
                                  ? "onboarding-field-id-document-upload-now-error"
                                  : undefined
                              }
                              className="mt-3"
                              name={ID_DOCUMENT_UPLOAD_NOW_FIELD}
                              value={uploadNowSelection ?? ""}
                              onValueChange={(nextValue) => {
                                if (nextValue === "yes") {
                                  setUploadNowSelection("yes");
                                  clearUploadRequirementErrors();
                                  setFormData((currentFormData) => ({
                                    ...currentFormData,
                                    [ID_DOCUMENT_UPLOAD_NOW_FIELD]: "yes",
                                  }));
                                  return;
                                }

                                if (nextValue === "no") {
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
                            >
                              <UiFieldLabel
                                htmlFor="onboarding-field-id-document-upload-now-yes"
                                className="flex items-center gap-2"
                              >
                                <UiRadioGroupItem
                                  id="onboarding-field-id-document-upload-now-yes"
                                  value="yes"
                                />
                                <span>{_(msg`Yes`)}</span>
                              </UiFieldLabel>
                              <UiFieldLabel
                                htmlFor="onboarding-field-id-document-upload-now-no"
                                className="flex items-center gap-2"
                              >
                                <UiRadioGroupItem
                                  id="onboarding-field-id-document-upload-now-no"
                                  value="no"
                                />
                                <span>{_(msg`No`)}</span>
                              </UiFieldLabel>
                            </UiRadioGroup>
                            {fieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD] ? (
                              <UiFieldError id="onboarding-field-id-document-upload-now-error">
                                {fieldErrors[ID_DOCUMENT_UPLOAD_NOW_FIELD]}
                              </UiFieldError>
                            ) : null}
                          </UiField>
                        </UiFieldGroup>

                        {uploadNowSelection === "yes" &&
                        shouldAskIdentityDocumentKind ? (
                          <UiFieldGroup className="mt-6">
                            <UiField>
                              <UiFieldLabel htmlFor="onboarding-field-id-document-kind">
                                <Trans>Which document are you uploading?</Trans>
                              </UiFieldLabel>
                              <UiFieldDescription id="onboarding-field-id-document-kind-description">
                                <Trans>
                                  For German nationals, you can provide either
                                  identity card or passport.
                                </Trans>
                              </UiFieldDescription>
                              <UiSelect
                                id="onboarding-field-id-document-kind"
                                aria-label={_(
                                  msg`Which document are you uploading?`
                                )}
                                aria-describedby="onboarding-field-id-document-kind-description"
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
                                    [ID_DOCUMENT_KIND_FIELD]: nextKind ?? "",
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
                              </UiSelect>
                            </UiField>
                          </UiFieldGroup>
                        ) : null}

                        {uploadNowSelection === "no" ? (
                          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
                            <Trans>
                              You can continue now and upload your documents
                              later.
                            </Trans>
                            <br />
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                              <Trans>
                                HR will still require these documents for the
                                Bewacherregister registration.
                              </Trans>
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              {stepUploadDocumentType &&
              uploadNowSelection === "yes" &&
              (!shouldAskIdentityDocumentKind ||
                identityDocumentKind !== null) ? (
                <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <h3 className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    <Trans>Identity Document Upload</Trans>
                  </h3>
                  <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                    {identityDocumentKind === "id_card" ? (
                      <Trans>
                        Please upload your identity card (PDF, JPG, JPEG, PNG;
                        max. 10 MB).
                      </Trans>
                    ) : identityDocumentKind === "passport" ||
                      primaryNationalityCode !== "DE" ? (
                      <Trans>
                        Please upload your passport (PDF, JPG, JPEG, PNG; max.
                        10 MB).
                      </Trans>
                    ) : (
                      <Trans>
                        Please upload your identity card or passport (PDF, JPG,
                        JPEG, PNG; max. 10 MB).
                      </Trans>
                    )}
                  </p>
                  <div className="mb-4 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      <Trans>Required documents for this step</Trans>
                    </p>
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
                          For identity cards, upload front and back as separate
                          files
                        </Trans>
                      </li>
                      <li>
                        <Trans>
                          Proof of residence registration (Meldebestätigung),
                          only if your ID does not show your current address
                        </Trans>
                      </li>
                    </ul>
                  </div>

                  {!submission ? (
                    <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                      <Trans>
                        Your current answers will be saved as a draft before the
                        first file upload.
                      </Trans>
                    </p>
                  ) : null}

                  {uploadFeedback ? (
                    <div
                      role={
                        uploadFeedback.tone === "error" ? "alert" : "status"
                      }
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
                      <p
                        className={
                          uploadFeedback.tone === "error"
                            ? "text-red-800 dark:text-red-200"
                            : "text-emerald-800 dark:text-emerald-200"
                        }
                      >
                        {uploadFeedback.message}
                      </p>
                    </div>
                  ) : null}

                  {isCurrentStepEditable ? (
                    <>
                      <UiFieldGroup>
                        <UiField>
                          <UiFieldLabel htmlFor="onboarding-identity-upload-attachment">
                            <Trans>Attachment</Trans>
                          </UiFieldLabel>
                          <UiFieldDescription id="onboarding-identity-upload-attachment-description">
                            <Trans>
                              Accepted formats: PDF, JPG, JPEG, PNG.
                            </Trans>
                          </UiFieldDescription>
                          <UiInput
                            id="onboarding-identity-upload-attachment"
                            ref={fileInputRef}
                            aria-label={_(msg`Attachment`)}
                            aria-describedby="onboarding-identity-upload-attachment-description"
                            accept={ONBOARDING_UPLOAD_ACCEPT}
                            className="file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-white/10 dark:file:text-white"
                            type="file"
                            onChange={(event) => {
                              const nextPrimaryFile =
                                event.target.files?.[0] ?? null;
                              setUploadContext(
                                nextPrimaryFile ? "identity_document" : null
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
                        </UiField>

                        {uploadFiles[0] ? (
                          <UiField>
                            <UiFieldLabel htmlFor="onboarding-identity-upload-attachment-extra">
                              <Trans>Attachment (optional second file)</Trans>
                            </UiFieldLabel>
                            <UiFieldDescription id="onboarding-identity-upload-attachment-extra-description">
                              <Trans>
                                Optional: Upload a second file, for example the
                                reverse side.
                              </Trans>
                            </UiFieldDescription>
                            <UiInput
                              id="onboarding-identity-upload-attachment-extra"
                              aria-label={_(
                                msg`Attachment (optional second file)`
                              )}
                              aria-describedby="onboarding-identity-upload-attachment-extra-description"
                              accept={ONBOARDING_UPLOAD_ACCEPT}
                              className="file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-white/10 dark:file:text-white"
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
                          </UiField>
                        ) : null}
                      </UiFieldGroup>

                      <div className="mt-4 flex items-center gap-4">
                        <Button
                          disabled={
                            uploadFiles.length === 0 || saving || uploading
                          }
                          onClick={() => void handleUpload("identity_document")}
                        >
                          {uploading ? (
                            <Trans>Uploading...</Trans>
                          ) : (
                            <Trans>Upload File</Trans>
                          )}
                        </Button>
                        {uploadFiles.length > 0 ? (
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {uploadFiles.map((file) => file.name).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      <Trans>
                        Files can only be uploaded while this onboarding step is
                        still editable.
                      </Trans>
                    </p>
                  )}
                </div>
              ) : null}

              {isIdentityUploadSectionCompleted &&
              isOnboardingFieldVisible(
                RESIDENCE_TITLE_TYPE_FIELD,
                formData,
                schema
              ) ? (
                <UiField>
                  <UiFieldLabel htmlFor="onboarding-field-residence-title-type">
                    <Trans>Residence title type</Trans> *
                  </UiFieldLabel>
                  <UiFieldDescription id="onboarding-field-residence-title-type-description">
                    <Trans>
                      Based on the selected nationality, please specify which
                      valid German residence title is available.
                    </Trans>
                  </UiFieldDescription>
                  <UiSelect
                    id="onboarding-field-residence-title-type"
                    aria-label={_(msg`Residence title type`)}
                    aria-describedby={
                      fieldErrors[RESIDENCE_TITLE_TYPE_FIELD]
                        ? "onboarding-field-residence-title-type-description onboarding-field-residence-title-type-error"
                        : "onboarding-field-residence-title-type-description"
                    }
                    aria-invalid={
                      fieldErrors[RESIDENCE_TITLE_TYPE_FIELD] ? true : undefined
                    }
                    disabled={!isCurrentStepEditable}
                    name={RESIDENCE_TITLE_TYPE_FIELD}
                    required={isCurrentStepEditable}
                    value={getTextValue(formData[RESIDENCE_TITLE_TYPE_FIELD])}
                    onChange={(event) =>
                      handleFieldChange(
                        RESIDENCE_TITLE_TYPE_FIELD,
                        event.target.value
                      )
                    }
                  >
                    <option value="">{_(msg`Select residence title`)}</option>
                    {RESIDENCE_TITLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {getResidenceTitleOptionLabel(option, i18n.locale)}
                      </option>
                    ))}
                  </UiSelect>
                  {fieldErrors[RESIDENCE_TITLE_TYPE_FIELD] ? (
                    <UiFieldError id="onboarding-field-residence-title-type-error">
                      {fieldErrors[RESIDENCE_TITLE_TYPE_FIELD]}
                    </UiFieldError>
                  ) : null}
                </UiField>
              ) : null}
              {areResidenceTitleFollowupFieldsUnlocked &&
              isOnboardingFieldVisible(
                RESIDENCE_TITLE_EXPIRY_FIELD,
                formData,
                schema
              ) ? (
                <UiField>
                  <UiFieldLabel htmlFor="onboarding-field-residence-title-expiry">
                    <Trans>Residence title valid until</Trans> *
                  </UiFieldLabel>
                  <UiFieldDescription id="onboarding-field-residence-title-expiry-description">
                    <Trans>
                      Enter the expiry date if the residence title is limited.
                    </Trans>
                  </UiFieldDescription>
                  <UiInput
                    id="onboarding-field-residence-title-expiry"
                    aria-label={_(msg`Residence title valid until`)}
                    aria-describedby={
                      fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD]
                        ? "onboarding-field-residence-title-expiry-description onboarding-field-residence-title-expiry-error"
                        : "onboarding-field-residence-title-expiry-description"
                    }
                    aria-invalid={
                      fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD]
                        ? true
                        : undefined
                    }
                    disabled={!isCurrentStepEditable}
                    type="date"
                    name={RESIDENCE_TITLE_EXPIRY_FIELD}
                    required={isCurrentStepEditable}
                    value={getTextValue(formData[RESIDENCE_TITLE_EXPIRY_FIELD])}
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
                    <UiFieldError id="onboarding-field-residence-title-expiry-error">
                      {fieldErrors[RESIDENCE_TITLE_EXPIRY_FIELD]}
                    </UiFieldError>
                  ) : null}
                </UiField>
              ) : null}
              {shouldAskEmploymentQuestion &&
              isOnboardingFieldVisible(
                RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
                formData,
                schema
              ) ? (
                <UiField>
                  <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                    <Trans>Employment permitted</Trans> *
                  </div>
                  <UiFieldDescription>
                    <Trans>
                      Is employment permitted for this residence title in
                      Germany?
                    </Trans>
                  </UiFieldDescription>
                  <UiRadioGroup
                    aria-label={_(msg`Employment permitted`)}
                    aria-invalid={
                      fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                        ? true
                        : undefined
                    }
                    aria-describedby={
                      fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                        ? "onboarding-field-residence-title-employment-allowed-error"
                        : undefined
                    }
                    className="mt-3"
                    name={RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD}
                    value={getTextValue(
                      formData[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]
                    )}
                    onValueChange={(nextValue) => {
                      if (nextValue === "yes" || nextValue === "no") {
                        handleFieldChange(
                          RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD,
                          nextValue
                        );
                      }
                    }}
                  >
                    <UiFieldLabel
                      htmlFor="onboarding-field-residence-title-employment-allowed-yes"
                      className="flex items-center gap-2"
                    >
                      <UiRadioGroupItem
                        id="onboarding-field-residence-title-employment-allowed-yes"
                        value="yes"
                        disabled={!isCurrentStepEditable}
                      />
                      <span>{_(msg`Yes`)}</span>
                    </UiFieldLabel>
                    <UiFieldLabel
                      htmlFor="onboarding-field-residence-title-employment-allowed-no"
                      className="flex items-center gap-2"
                    >
                      <UiRadioGroupItem
                        id="onboarding-field-residence-title-employment-allowed-no"
                        value="no"
                        disabled={!isCurrentStepEditable}
                      />
                      <span>{_(msg`No`)}</span>
                    </UiFieldLabel>
                  </UiRadioGroup>
                  {fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD] ? (
                    <UiFieldError id="onboarding-field-residence-title-employment-allowed-error">
                      {fieldErrors[RESIDENCE_TITLE_EMPLOYMENT_ALLOWED_FIELD]}
                    </UiFieldError>
                  ) : null}
                </UiField>
              ) : null}
              {isIdentityUploadSectionCompleted &&
              shouldAskResidenceTitleUploadNow ? (
                <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <UiFieldGroup>
                    <UiField>
                      <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        <Trans>
                          Would you like to upload your residence title now?
                        </Trans>
                      </div>
                      <UiFieldDescription>
                        <Trans>
                          You can upload now or continue and add this document
                          later before final submission.
                        </Trans>
                      </UiFieldDescription>
                      <UiRadioGroup
                        aria-label={_(
                          msg`Would you like to upload your residence title now?`
                        )}
                        aria-invalid={
                          fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]
                            ? "onboarding-field-residence-title-upload-now-error"
                            : undefined
                        }
                        className="mt-3"
                        name={RESIDENCE_TITLE_UPLOAD_NOW_FIELD}
                        value={residenceTitleUploadNowSelection ?? ""}
                        onValueChange={(nextValue) => {
                          if (nextValue === "yes") {
                            setResidenceTitleUploadNowSelection("yes");
                            clearUploadRequirementErrors();
                            setFormData((currentFormData) => ({
                              ...currentFormData,
                              [RESIDENCE_TITLE_UPLOAD_NOW_FIELD]: "yes",
                            }));
                            return;
                          }

                          if (nextValue === "no") {
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
                      >
                        <UiFieldLabel
                          htmlFor="onboarding-field-residence-title-upload-now-yes"
                          className="flex items-center gap-2"
                        >
                          <UiRadioGroupItem
                            id="onboarding-field-residence-title-upload-now-yes"
                            value="yes"
                            disabled={!isCurrentStepEditable}
                          />
                          <span>{_(msg`Yes`)}</span>
                        </UiFieldLabel>
                        <UiFieldLabel
                          htmlFor="onboarding-field-residence-title-upload-now-no"
                          className="flex items-center gap-2"
                        >
                          <UiRadioGroupItem
                            id="onboarding-field-residence-title-upload-now-no"
                            value="no"
                            disabled={!isCurrentStepEditable}
                          />
                          <span>{_(msg`No`)}</span>
                        </UiFieldLabel>
                      </UiRadioGroup>
                      {fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD] ? (
                        <UiFieldError id="onboarding-field-residence-title-upload-now-error">
                          {fieldErrors[RESIDENCE_TITLE_UPLOAD_NOW_FIELD]}
                        </UiFieldError>
                      ) : null}
                    </UiField>
                  </UiFieldGroup>

                  {residenceTitleUploadNowSelection === "yes" ? (
                    <div className="mt-6">
                      <h3 className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                        <Trans>Residence Title Upload</Trans>
                      </h3>
                      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                        <Trans>
                          Please upload your residence title (PDF, JPG, JPEG,
                          PNG; max. 10 MB).
                        </Trans>
                      </p>
                      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                        <Trans>
                          Upload front and back as separate files if available.
                        </Trans>
                      </p>

                      {isCurrentStepEditable ? (
                        <>
                          <UiFieldGroup>
                            <UiField>
                              <UiFieldLabel htmlFor="onboarding-residence-title-upload-attachment">
                                <Trans>Attachment</Trans>
                              </UiFieldLabel>
                              <UiFieldDescription id="onboarding-residence-title-upload-attachment-description">
                                <Trans>
                                  Accepted formats: PDF, JPG, JPEG, PNG.
                                </Trans>
                              </UiFieldDescription>
                              <UiInput
                                id="onboarding-residence-title-upload-attachment"
                                aria-label={_(msg`Attachment`)}
                                aria-describedby="onboarding-residence-title-upload-attachment-description"
                                accept={ONBOARDING_UPLOAD_ACCEPT}
                                className="file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-white/10 dark:file:text-white"
                                type="file"
                                onChange={(event) => {
                                  const nextPrimaryFile =
                                    event.target.files?.[0] ?? null;
                                  setUploadContext(
                                    nextPrimaryFile ? "residence_permit" : null
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
                            </UiField>

                            {uploadFiles[0] ? (
                              <UiField>
                                <UiFieldLabel htmlFor="onboarding-residence-title-upload-attachment-extra">
                                  <Trans>
                                    Attachment (optional second file)
                                  </Trans>
                                </UiFieldLabel>
                                <UiFieldDescription id="onboarding-residence-title-upload-attachment-extra-description">
                                  <Trans>
                                    Optional: Upload the reverse side as a
                                    second file.
                                  </Trans>
                                </UiFieldDescription>
                                <UiInput
                                  id="onboarding-residence-title-upload-attachment-extra"
                                  aria-label={_(
                                    msg`Attachment (optional second file)`
                                  )}
                                  aria-describedby="onboarding-residence-title-upload-attachment-extra-description"
                                  accept={ONBOARDING_UPLOAD_ACCEPT}
                                  className="file:mr-4 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium dark:file:bg-white/10 dark:file:text-white"
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
                              </UiField>
                            ) : null}
                          </UiFieldGroup>
                          <div className="mt-4 flex items-center gap-4">
                            <Button
                              disabled={
                                uploadFiles.length === 0 || saving || uploading
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
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                {uploadFiles
                                  .map((file) => file.name)
                                  .join(", ")}
                              </p>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          <Trans>
                            Files can only be uploaded while this onboarding
                            step is still editable.
                          </Trans>
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </UiFieldGroup>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
              <p className="text-amber-800 dark:text-amber-200">
                <Trans>
                  This onboarding step uses a schema we cannot render yet.
                </Trans>
              </p>
            </div>
          )}

          {stepUploadDocumentType && uploadedFiles.length > 0 ? (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <Trans>Uploaded in this session</Trans>
              </p>
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
                        variant="outline"
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
        </CardContent>
      </section>
    </div>
  );
}

export default OnboardingWizard;
