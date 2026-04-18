// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  OnboardingStep,
  OnboardingSubmission,
} from "../../services/onboardingApi";

export function getOnboardingStepState(step: OnboardingStep | undefined): {
  submission: OnboardingSubmission | null;
  formData: Record<string, unknown>;
} {
  const submission = step?.submission ?? null;

  return {
    submission,
    formData:
      submission?.form_data && typeof submission.form_data === "object"
        ? submission.form_data
        : {},
  };
}
