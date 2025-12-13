// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { Trans } from "@lingui/macro";
import {
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  createOnboardingSubmission,
  updateOnboardingSubmission,
  uploadOnboardingFile,
  type OnboardingStep,
  type OnboardingFormTemplate,
  type OnboardingSubmission,
} from "../../services/onboardingApi";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";

/**
 * Progress indicator
 */
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
      <div className="flex items-center justify-between mb-2">
        <Text className="text-sm font-medium text-gray-700">
          <Trans>
            Step {currentStep} of {totalSteps}
          </Trans>
        </Text>
        <Text className="text-sm font-medium text-gray-700">
          {Math.round(percentage)}%
        </Text>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Step navigation
 */
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
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
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

/**
 * File upload component
 */
function FileUpload({
  label,
  documentType,
  onFileUpload,
  uploading,
  uploadedFile,
}: {
  label: string;
  documentType: string;
  onFileUpload: (file: File, type: string) => Promise<void>;
  uploading: boolean;
  uploadedFile?: { id: string; filename: string };
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleUpload() {
    if (!selectedFile) return;
    await onFileUpload(selectedFile, documentType);
    setSelectedFile(null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? <Trans>Uploading...</Trans> : <Trans>Upload</Trans>}
        </Button>
      </div>
      {uploadedFile && (
        <Text className="text-sm text-green-600">
          <Trans>Uploaded: {uploadedFile.filename}</Trans>
        </Text>
      )}
    </div>
  );
}

/**
 * Onboarding Wizard Page
 */
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
  const [uploadedFiles, setUploadedFiles] = useState<
    Record<string, { id: string; filename: string }>
  >({});

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
    if (!steps[currentStepIndex]) return;

    try {
      setLoading(true);
      const templateData = await fetchOnboardingTemplate(
        steps[currentStepIndex].template_id
      );
      setTemplate(templateData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load form template"
      );
    } finally {
      setLoading(false);
    }
  }, [steps, currentStepIndex]);

  useEffect(() => {
    loadOnboardingSteps();
  }, [loadOnboardingSteps]);

  useEffect(() => {
    if (steps.length > 0) {
      loadCurrentTemplate();
    }
  }, [loadCurrentTemplate, steps.length]);

  async function handleSaveDraft() {
    if (!template) return;

    try {
      setSaving(true);
      setError(null);

      if (submission) {
        await updateOnboardingSubmission(submission.id, {
          form_data: formData,
          status: "draft",
        });
      } else {
        const newSubmission = await createOnboardingSubmission({
          template_id: template.id,
          form_data: formData,
          status: "draft",
        });
        setSubmission(newSubmission);
      }

      alert("Draft saved successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await handleSaveDraft();
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setFormData({});
    }
  }

  function handlePrevious() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      setFormData({});
    }
  }

  async function handleSubmit() {
    if (!template || !submission) return;

    try {
      setSaving(true);
      setError(null);

      await updateOnboardingSubmission(submission.id, {
        form_data: formData,
        status: "submitted",
      });

      alert(
        "Onboarding submitted successfully! HR will review your submission."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileUpload(file: File, documentType: string) {
    if (!submission) {
      await handleSaveDraft();
    }

    if (!submission) return;

    try {
      const result = await uploadOnboardingFile(
        submission.id,
        file,
        documentType
      );
      setUploadedFiles({
        ...uploadedFiles,
        [documentType]: result,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    }
  }

  if (loading && steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Text>
          <Trans>Loading onboarding...</Trans>
        </Text>
      </div>
    );
  }

  if (error && steps.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <Text className="text-red-800">{error}</Text>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg p-6">
        <Heading className="mb-6">
          <Trans>Welcome to SecPal Onboarding</Trans>
        </Heading>

        <ProgressIndicator
          currentStep={currentStepIndex + 1}
          totalSteps={steps.length}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <Text className="text-red-800">{error}</Text>
          </div>
        )}

        {currentStep && template && (
          <div>
            <Heading level={2} className="mb-4">
              {template.title}
            </Heading>

            {template.description && (
              <Text className="mb-6 text-gray-600">{template.description}</Text>
            )}

            {/* Dynamic form fields based on schema */}
            <div className="space-y-6">
              {/* Document Upload Section */}
              {currentStep.step_number === 3 && (
                <div className="space-y-4">
                  <FileUpload
                    label="Contract Document"
                    documentType="contract"
                    onFileUpload={handleFileUpload}
                    uploading={saving}
                    uploadedFile={uploadedFiles["contract"]}
                  />
                  <FileUpload
                    label="ID Document"
                    documentType="id_document"
                    onFileUpload={handleFileUpload}
                    uploading={saving}
                    uploadedFile={uploadedFiles["id_document"]}
                  />
                  <FileUpload
                    label="Banking Details"
                    documentType="banking_details"
                    onFileUpload={handleFileUpload}
                    uploading={saving}
                    uploadedFile={uploadedFiles["banking_details"]}
                  />
                </div>
              )}

              {/* Placeholder for other form fields based on schema */}
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                <Text className="text-gray-500 text-center">
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
              canGoNext={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default OnboardingWizard;
