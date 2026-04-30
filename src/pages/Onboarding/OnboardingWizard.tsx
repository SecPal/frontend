// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Trans } from "@lingui/react/macro";
import {
  createOnboardingSubmission,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  type OnboardingFormTemplate,
  type OnboardingStep,
  type OnboardingSubmission,
  updateOnboardingSubmission,
} from "../../services/onboardingApi";
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from "../../components/checkbox";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import {
  Description,
  Field,
  FieldGroup,
  Fieldset,
  Label,
} from "../../components/fieldset";
import { Input } from "../../components/input";
import { Select } from "../../components/select";
import { Text } from "../../components/text";
import { Textarea } from "../../components/textarea";
import { getOnboardingStepState } from "./onboardingWizardState";

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
    ? value.filter((entry): entry is string => typeof entry === "string")
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
  formData,
  onChange,
}: {
  fieldName: string;
  property: OnboardingSchemaProperty;
  required: boolean;
  formData: Record<string, unknown>;
  onChange: (fieldName: string, value: unknown) => void;
}) {
  const title = property.title ?? fieldName;

  if (property.type === "string") {
    const options = getSchemaOptions(property);

    return (
      <Field>
        <Label>
          {title}
          {required ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
        {options.length > 0 ? (
          <Select
            aria-label={title}
            name={fieldName}
            value={getTextValue(formData[fieldName])}
            onChange={(event) => onChange(fieldName, event.target.value)}
          >
            <option value="">Select an option</option>
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            aria-label={title}
            name={fieldName}
            value={getTextValue(formData[fieldName])}
            maxLength={property.maxLength}
            onChange={(event) => onChange(fieldName, event.target.value)}
          />
        )}
      </Field>
    );
  }

  if (property.type === "integer" || property.type === "number") {
    const options = getSchemaOptions(property);

    return (
      <Field>
        <Label>
          {title}
          {required ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
        {options.length > 0 ? (
          <Select
            aria-label={title}
            name={fieldName}
            value={getNumberValue(formData[fieldName])}
            onChange={(event) =>
              onChange(fieldName, Number(event.target.value))
            }
          >
            <option value="">Select an option</option>
            {options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            aria-label={title}
            type="number"
            name={fieldName}
            value={getNumberValue(formData[fieldName])}
            min={property.minimum}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange(fieldName, nextValue === "" ? "" : Number(nextValue));
            }}
          />
        )}
      </Field>
    );
  }

  if (property.type === "boolean") {
    return (
      <CheckboxField>
        <Checkbox
          aria-label={title}
          checked={getBooleanValue(formData[fieldName])}
          onChange={(checked) => onChange(fieldName, checked)}
        />
        <Label>
          {title}
          {required ? " *" : null}
        </Label>
        {property.description ? (
          <Description>{property.description}</Description>
        ) : null}
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
            {required ? " *" : null}
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
        </Field>
      );
    }

    return (
      <Field>
        <Label>
          {title}
          {required ? " *" : null}
        </Label>
        <Description>
          {property.description ?? "Enter one value per line."}
        </Description>
        <Textarea
          aria-label={title}
          name={fieldName}
          rows={4}
          value={getArrayTextareaValue(formData[fieldName])}
          onChange={(event) =>
            onChange(fieldName, parseArrayTextareaValue(event.target.value))
          }
        />
      </Field>
    );
  }

  return null;
}

function StepNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSaveDraft,
  onSubmit,
  canGoNext,
}: {
  currentStep: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  canGoNext: boolean;
}) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6 dark:border-zinc-800">
      <div>
        {!isFirstStep && (
          <Button onClick={onPrevious} outline>
            <Trans>Previous</Trans>
          </Button>
        )}
      </div>

      <div className="flex gap-4">
        <Button onClick={onSaveDraft} outline>
          <Trans>Save Draft</Trans>
        </Button>

        {isLastStep ? (
          <Button onClick={onSubmit} disabled={!canGoNext}>
            <Trans>Submit for Review</Trans>
          </Button>
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
  const currentStepTemplateId = steps[currentStepIndex]?.template_id;
  const schema = template ? getObjectSchema(template.form_schema) : null;

  useEffect(() => {
    let active = true;

    void fetchOnboardingSteps()
      .then((data) => {
        if (!active) {
          return;
        }

        setError(null);
        setFeedback(null);
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
  }, []);

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
  ): Promise<boolean> {
    if (!template) {
      return false;
    }

    try {
      setSaving(true);
      setError(null);
      setFeedback(null);

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
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : status === "draft"
            ? "Failed to save draft"
            : "Failed to submit"
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft() {
    if (await persistCurrentStep("draft")) {
      setFeedback({
        tone: "success",
        message: "Draft saved. You can continue later.",
      });
    }
  }

  async function handleNext() {
    if (
      (await persistCurrentStep("draft")) &&
      currentStepIndex < steps.length - 1
    ) {
      const nextStep = steps[currentStepIndex + 1];
      const nextStepState = getOnboardingStepState(nextStep);

      setLoading(true);
      setError(null);
      setFeedback(null);
      setTemplate(null);
      setSubmission(nextStepState.submission);
      setFormData(nextStepState.formData);
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }

  function handlePrevious() {
    if (currentStepIndex > 0) {
      const previousStep = steps[currentStepIndex - 1];
      const previousStepState = getOnboardingStepState(previousStep);

      setLoading(true);
      setError(null);
      setFeedback(null);
      setTemplate(null);
      setSubmission(previousStepState.submission);
      setFormData(previousStepState.formData);
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }

  async function handleSubmit() {
    if (await persistCurrentStep("submitted")) {
      setFeedback({
        tone: "success",
        message: "Onboarding submitted. HR will review your information.",
      });
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
            <Heading level={2} className="mb-4">
              {template.title ?? template.name}
            </Heading>

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
                        required={schema.required.includes(fieldName)}
                        formData={formData}
                        onChange={(nextFieldName, value) =>
                          setFormData((currentFormData) => ({
                            ...currentFormData,
                            [nextFieldName]: value,
                          }))
                        }
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

            <StepNavigation
              currentStep={currentStepIndex + 1}
              totalSteps={steps.length}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSaveDraft={handleSaveDraft}
              onSubmit={handleSubmit}
              canGoNext={!saving}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
