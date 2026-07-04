// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import type { OnboardingStep } from "../../services/onboardingApi";
import {
  getOnboardingStepState,
  isOnboardingAwaitingHrReview,
} from "./onboardingWizardState";

describe("getOnboardingStepState", () => {
  it("returns submission data for the current onboarding step", () => {
    const step: OnboardingStep = {
      step_number: 1,
      title: "Personal Information",
      template_id: "template-1",
      is_required: true,
      is_completed: false,
      submission: {
        id: "submission-1",
        employee_id: "employee-1",
        form_template_id: "template-1",
        form_data: {
          first_name: "Ada",
        },
        status: "draft",
        created_at: "2026-04-18T00:00:00Z",
        updated_at: "2026-04-18T00:00:00Z",
      },
    };

    expect(getOnboardingStepState(step)).toEqual({
      submission: step.submission,
      formData: {
        first_name: "Ada",
      },
    });
  });

  it("falls back to empty step state when the step has no submission", () => {
    const step: OnboardingStep = {
      step_number: 2,
      title: "Identity Documents",
      template_id: "template-2",
      is_required: true,
      is_completed: false,
      submission: null,
    };

    expect(getOnboardingStepState(step)).toEqual({
      submission: null,
      formData: {},
    });
  });

  it("falls back to empty formData when submission has null form_data", () => {
    const step: OnboardingStep = {
      step_number: 3,
      title: "Bank Details",
      template_id: "template-3",
      is_required: true,
      is_completed: false,
      submission: {
        id: "submission-3",
        employee_id: "employee-1",
        form_template_id: "template-3",
        form_data: null,
        status: "draft",
        created_at: "2026-04-18T00:00:00Z",
        updated_at: "2026-04-18T00:00:00Z",
      },
    };

    expect(getOnboardingStepState(step)).toEqual({
      submission: step.submission,
      formData: {},
    });
  });
});

describe("isOnboardingAwaitingHrReview", () => {
  it("is false for an empty step list", () => {
    expect(isOnboardingAwaitingHrReview([])).toBe(false);
  });

  it("is true when all required steps are submitted or approved", () => {
    const base = (
      status: "draft" | "submitted" | "approved"
    ): OnboardingStep[] => [
      {
        step_number: 1,
        title: "First",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {},
          status,
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
    ];

    expect(isOnboardingAwaitingHrReview(base("submitted"))).toBe(true);
    expect(isOnboardingAwaitingHrReview(base("approved"))).toBe(true);
    expect(isOnboardingAwaitingHrReview(base("draft"))).toBe(false);
  });

  it("is false when any required step is still incomplete", () => {
    const steps: OnboardingStep[] = [
      {
        step_number: 1,
        title: "First",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {},
          status: "draft",
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Last",
        template_id: "template-2",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-2",
          employee_id: "employee-1",
          form_template_id: "template-2",
          form_data: {},
          status: "submitted",
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
    ];

    expect(isOnboardingAwaitingHrReview(steps)).toBe(false);
  });

  it("ignores incomplete optional steps once required steps are submitted", () => {
    const steps: OnboardingStep[] = [
      {
        step_number: 1,
        title: "Required",
        template_id: "template-1",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {},
          status: "submitted",
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Optional",
        template_id: "template-2",
        is_required: false,
        is_completed: false,
        submission: null,
      },
    ];

    expect(isOnboardingAwaitingHrReview(steps)).toBe(true);
  });

  it("falls back to the last step status when there are no required steps", () => {
    const steps: OnboardingStep[] = [
      {
        step_number: 1,
        title: "Optional one",
        template_id: "template-1",
        is_required: false,
        is_completed: false,
        submission: null,
      },
      {
        step_number: 2,
        title: "Optional two",
        template_id: "template-2",
        is_required: false,
        is_completed: true,
        submission: {
          id: "submission-2",
          employee_id: "employee-1",
          form_template_id: "template-2",
          form_data: {},
          status: "submitted",
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
    ];

    expect(isOnboardingAwaitingHrReview(steps)).toBe(true);
  });

  it("is false when a required step was rejected or has no submission yet", () => {
    const rejected: OnboardingStep[] = [
      {
        step_number: 1,
        title: "Only",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {},
          status: "rejected",
          created_at: "2026-04-18T00:00:00Z",
          updated_at: "2026-04-18T00:00:00Z",
        },
      },
    ];

    expect(isOnboardingAwaitingHrReview(rejected)).toBe(false);

    const noSubmission: OnboardingStep[] = [
      {
        step_number: 1,
        title: "Only",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ];

    expect(isOnboardingAwaitingHrReview(noSubmission)).toBe(false);
  });
});
