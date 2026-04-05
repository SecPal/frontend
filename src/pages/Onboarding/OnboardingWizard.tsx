// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback, useEffect, useState } from "react";
import { Trans } from "@lingui/macro";
import {
  createOnboardingSubmission,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  type OnboardingFormTemplate,
  type OnboardingStep,
  type OnboardingSubmission,
} from "../../services/onboardingApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";

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
        <Text className="text-sm font-medium text-gray-700">
          <Trans>
            Step {currentStep} of {totalSteps}
          </Trans>
        </Text>
        <Text className="text-sm font-medium text-gray-700">
          {Math.round(percentage)}%
        </Text>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <div
          className="h-2.5 rounded-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
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
    <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
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

  const loadOnboardingSteps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchOnboardingSteps();
      setSteps(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load onboarding steps"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentTemplate = useCallback(async () => {
    const currentStep = steps[currentStepIndex];

    if (!currentStep) {
      return;
    }

    try {
      setLoading(true);
      const templateData = await fetchOnboardingTemplate(
        currentStep.template_id
      );
      const currentSubmission = currentStep.submission ?? null;

      setTemplate(templateData);
      setSubmission(currentSubmission);
      setFormData(
        currentSubmission?.form_data &&
          typeof currentSubmission.form_data === "object"
          ? currentSubmission.form_data
          : {}
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load form template"
      );
    } finally {
      setLoading(false);
    }
  }, [currentStepIndex, steps]);

  useEffect(() => {
    void loadOnboardingSteps();
  }, [loadOnboardingSteps]);

  // Re-fetch the template only when the user navigates to a different step or
  // when steps first arrive — not on every draft-save that updates steps content.
  useEffect(() => {
    if (steps.length > 0) {
      void loadCurrentTemplate();
    }
    // Intentionally omitting `loadCurrentTemplate` from deps: including it would
    // retrigger this effect on every setSteps call (e.g. after saving a draft),
    // causing an unnecessary API round-trip. The effect should only run when
    // the active step index or the step count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, steps.length]);

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

      const savedSubmission = await createOnboardingSubmission({
        form_template_id: template.id,
        form_data:
          Object.keys(formData).length > 0
            ? formData
            : ((submission?.form_data as Record<string, unknown> | null) ?? {}),
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
      alert("Draft saved successfully!");
    }
  }

  async function handleNext() {
    if (
      (await persistCurrentStep("draft")) &&
      currentStepIndex < steps.length - 1
    ) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }

  function handlePrevious() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }

  async function handleSubmit() {
    if (await persistCurrentStep("submitted")) {
      alert(
        "Onboarding submitted successfully! HR will review your submission."
      );
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
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <Heading className="mb-6">
          <Trans>Welcome to SecPal Onboarding</Trans>
        </Heading>

        <ProgressIndicator
          currentStep={currentStepIndex + 1}
          totalSteps={steps.length}
        />

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <Text className="text-red-800">{error}</Text>
          </div>
        )}

        {template && (
          <div>
            <Heading level={2} className="mb-4">
              {template.title ?? template.name}
            </Heading>

            {template.description && (
              <Text className="mb-6 text-gray-600">{template.description}</Text>
            )}

            <div className="space-y-6">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-4">
                <Text className="text-center text-gray-500">
                  <Trans>Form fields will be rendered based on schema</Trans>
                </Text>
              </div>
            </div>

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
