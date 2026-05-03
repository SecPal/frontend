// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  OnboardingStep,
  OnboardingSubmission,
} from "../../services/onboardingApi";

/** Every required step submitted or approved — employee flow finished; HR review pending or done at contract level. */
export function isOnboardingAwaitingHrReview(steps: OnboardingStep[]): boolean {
  if (steps.length === 0) {
    return false;
  }

  const requiredSteps = steps.filter((step) => step.is_required);
  if (requiredSteps.length === 0) {
    const status = steps[steps.length - 1]?.submission?.status;
    return status === "submitted" || status === "approved";
  }

  return requiredSteps.every((step) => {
    const status = step.submission?.status;
    return status === "submitted" || status === "approved";
  });
}

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
