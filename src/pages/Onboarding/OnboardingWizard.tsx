// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef, useState } from "react";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useNavigate } from "react-router-dom";
import {
  createOnboardingSubmission,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
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
import {
  getOnboardingStepState,
  isOnboardingAwaitingHrReview,
} from "./onboardingWizardState";

interface OnboardingSchemaArrayItems {
  enum?: Array<string | number>;
  enumNames?: string[];
  type?: "string" | "integer" | "number";
}

interface OnboardingSchemaProperty {
  description?: string;
  enum?: Array<string | number>;
  enumNames?: string[];
  items?: OnboardingSchemaArrayItems;
  maxLength?: number;
  minimum?: number;
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

type FieldErrors = Record<string, string>;
type OnboardingDocumentType = "contract" | "id_document" | "banking_details";

interface UploadedOnboardingFile {
  id: string;
  filename: string;
  documentType: OnboardingDocumentType;
}

const ONBOARDING_UPLOAD_ACCEPT = ".pdf,.jpg,.jpeg,.png";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getObjectSchema(
  formSchema: Record<string, unknown>
): OnboardingObjectSchema | null {
  if (formSchema.type !== "object" || !isRecord(formSchema.properties)) {
    return null;
  }

  return {
    properties: formSchema.properties as Record<
      string,
      OnboardingSchemaProperty
    >,
    required: Array.isArray(formSchema.required)
      ? formSchema.required.filter(
          (entry): entry is string => typeof entry === "string"
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
  return schema.required.reduce<FieldErrors>((errors, fieldName) => {
    const property = schema.properties[fieldName];

    if (!property || !isRequiredFieldFilled(property, formData[fieldName])) {
      errors[fieldName] = requiredFieldMessage;
    }

    return errors;
  }, {});
}

/** True when every schema field is empty — optional steps can be skipped without validation. */
function isSchemaFormSemanticallyEmpty(
  schema: OnboardingObjectSchema,
  formData: Record<string, unknown>
): boolean {
  return Object.keys(schema.properties).every((fieldName) => {
    const property = schema.properties[fieldName];

    if (!property) {
      return true;
    }

    return !isRequiredFieldFilled(property, formData[fieldName]);
  });
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
  error,
  onChange,
}: {
  fieldName: string;
  property: OnboardingSchemaProperty;
  required: boolean;
  readOnly: boolean;
  formData: Record<string, unknown>;
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
    const itemOptions = property.items ? getSchemaOptions(property.items) : [];
    const selectedValues = getArrayValue(formData[fieldName]);

    if (itemOptions.length > 0) {
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
  const navigate = useNavigate();
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
  const currentStepIndexRef = useRef(0);
  const currentStepTemplateId = steps[currentStepIndex]?.template_id;
  const schema = template ? getObjectSchema(template.form_schema) : null;
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
          err instanceof Error ? err.message : "Failed to load onboarding steps"
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  // Re-fetch the template only when the user navigates to a different step or
  // when steps first arrive — not on every draft-save that updates steps content.
  useEffect(() => {
    if (!currentStepTemplateId) {
      return;
    }

    let active = true;

    void fetchOnboardingTemplate(currentStepTemplateId)
      .then((templateData) => {
        if (!active) {
          return;
        }

        setTemplate(templateData);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Failed to load form template"
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

  function updateCurrentStep(
    savedSubmission: OnboardingSubmission,
    status: "draft" | "submitted"
  ) {
    setSteps((currentSteps) =>
      currentSteps.map((step, index) =>
        index === currentStepIndex
          ? {
              ...step,
              is_completed: status === "submitted" ? true : step.is_completed,
              submission: savedSubmission,
            }
          : step
      )
    );
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

      const nextFormData =
        Object.keys(formData).length > 0
          ? formData
          : ((submission?.form_data as Record<string, unknown> | null) ?? {});

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
        for (const [key, messages] of Object.entries(err.errors)) {
          if (
            key === "form_data" ||
            key === "onboarding_workflow_status" ||
            key === "status"
          ) {
            continue;
          }
          // The API returns Laravel-style nested keys such as "form_data.iban".
          // Strip the "form_data." prefix so errors map to bare field names.
          const fieldKey = key.startsWith("form_data.")
            ? key.slice("form_data.".length)
            : key;
          const first = messages[0];
          if (first) {
            nextFieldErrors[fieldKey] = first;
          }
        }
        setError(null);
        setFieldErrors(nextFieldErrors);
        const supplemental =
          err.errors.form_data?.[0] ??
          err.errors.onboarding_workflow_status?.[0];
        const hasInline = Object.keys(nextFieldErrors).length > 0;
        setFeedback({
          tone: "error",
          message: supplemental
            ? supplemental
            : hasInline
              ? _(
                  msg`We couldn't submit the form yet. Please review the highlighted fields.`
                )
              : err.message ||
                _(
                  msg`We couldn't submit the form yet. Please review the highlighted fields.`
                ),
        });
        return null;
      }

      setError(
        err instanceof Error
          ? err.message
          : status === "draft"
            ? _(msg`Failed to save draft`)
            : _(msg`Failed to submit`)
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

  async function handleNext() {
    if (saving || uploading) {
      return;
    }

    const shouldPersistDraft = isEditableSubmission(submission);

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

    if (schema && template) {
      const isOptionalTemplate = template.is_required === false;
      const skipRequiredValidation =
        isOptionalTemplate && isSchemaFormSemanticallyEmpty(schema, formData);

      if (!skipRequiredValidation) {
        const nextFieldErrors = validateRequiredFields(
          schema,
          formData,
          _(msg`This field is required.`)
        );

        if (Object.keys(nextFieldErrors).length > 0) {
          setError(null);
          setFieldErrors(nextFieldErrors);
          setFeedback({
            tone: "error",
            message: _(
              msg`We couldn't submit the form yet. Please review the highlighted fields.`
            ),
          });
          return;
        }
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
    setFormData((currentFormData) => ({
      ...currentFormData,
      [fieldName]: value,
    }));

    const property = schema?.properties[fieldName];

    if (!property) {
      return;
    }

    setFieldErrors((currentFieldErrors) => {
      if (!currentFieldErrors[fieldName]) {
        return currentFieldErrors;
      }

      if (!isRequiredFieldFilled(property, value)) {
        return currentFieldErrors;
      }

      const nextFieldErrors = { ...currentFieldErrors };
      delete nextFieldErrors[fieldName];
      return nextFieldErrors;
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

      const uploadedFileResponse = await uploadOnboardingFile(
        targetSubmission.id,
        uploadFile,
        uploadDocumentType
      );

      if (currentStepIndexRef.current !== startedStepIndex) {
        return;
      }

      setUploadedFiles((currentFiles) => [
        ...currentFiles,
        {
          ...uploadedFileResponse,
          documentType: uploadDocumentType,
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
      setUploadFeedback({
        tone: "error",
        message:
          err instanceof Error && err.message !== "Failed to upload file"
            ? err.message
            : _(msg`Failed to upload file`),
      });
    } finally {
      setUploading(false);
    }
  }

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
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <Text className="text-red-800">{error}</Text>
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

        {feedback ? (
          <div
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
                  {Object.entries(schema.properties).map(
                    ([fieldName, property]) => (
                      <SchemaFieldRenderer
                        key={fieldName}
                        fieldName={fieldName}
                        property={property}
                        error={fieldErrors[fieldName]}
                        readOnly={!isCurrentStepEditable}
                        required={schema.required.includes(fieldName)}
                        formData={formData}
                        onChange={handleFieldChange}
                      />
                    )
                  )}
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
                <Trans>Supporting Documents</Trans>
              </Heading>
              <Text className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                <Trans>
                  On every onboarding step you can upload PDF, JPG, or PNG files
                  up to 10 MB — choose contract, identity document, or banking
                  verification as appropriate.
                </Trans>
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
                      <Field>
                        <Label>
                          <Trans>Document Type</Trans>
                        </Label>
                        <Description>
                          <Trans>
                            Choose the attachment category that best matches the
                            file.
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
