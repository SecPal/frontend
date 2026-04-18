// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type { OnboardingStep } from "../../services/onboardingApi";
import { getOnboardingStepState } from "./onboardingWizardState";

describe("getOnboardingStepState", () => {
  it("returns submission data for the current onboarding step", () => {
    const step: OnboardingStep = {
      step_number: 1,
      title: "Personal Information",
      template_id: "template-1",
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
      is_completed: false,
      submission: null,
    };

    expect(getOnboardingStepState(step)).toEqual({
      submission: null,
      formData: {},
    });
  });
});
