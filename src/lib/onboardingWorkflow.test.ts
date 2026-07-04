// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import {
  getAuthOnboardingWorkflowStatus,
  isSubmittedOnboardingWorkflowStatus,
  SUBMITTED_ONBOARDING_WORKFLOW_STATUSES,
} from "./onboardingWorkflow";
import type { User } from "../contexts/auth-context";

describe("getAuthOnboardingWorkflowStatus", () => {
  it("returns undefined for null user", () => {
    expect(getAuthOnboardingWorkflowStatus(null)).toBeUndefined();
  });

  it("returns undefined for undefined user", () => {
    expect(getAuthOnboardingWorkflowStatus(undefined)).toBeUndefined();
  });

  it("returns the top-level onboardingWorkflowStatus when present", () => {
    const user: User = {
      id: "1",
      name: "Test",
      email: "test@secpal.dev",
      onboardingWorkflowStatus: "submitted_for_review",
    };
    expect(getAuthOnboardingWorkflowStatus(user)).toBe("submitted_for_review");
  });

  it("returns undefined when onboardingWorkflowStatus is absent — the auth hydration layer is the single source", () => {
    // sanitizeAuthUser in authState.ts already promotes
    // employee.onboarding_workflow.status → User.onboardingWorkflowStatus.
    // By the time a User reaches this helper, the nested path is redundant.
    const user: User = {
      id: "1",
      name: "Test",
      email: "test@secpal.dev",
      employee: {
        onboarding_workflow: { status: "submitted_for_review" },
      },
    };
    expect(getAuthOnboardingWorkflowStatus(user)).toBeUndefined();
  });
});

describe("isSubmittedOnboardingWorkflowStatus", () => {
  it("returns false for undefined", () => {
    expect(isSubmittedOnboardingWorkflowStatus(undefined)).toBe(false);
  });

  it("returns true for every submitted status", () => {
    for (const status of SUBMITTED_ONBOARDING_WORKFLOW_STATUSES) {
      expect(isSubmittedOnboardingWorkflowStatus(status)).toBe(true);
    }
  });

  it("returns false for editable statuses", () => {
    for (const status of [
      "account_initialized",
      "in_progress",
      "changes_requested",
    ] as const) {
      expect(isSubmittedOnboardingWorkflowStatus(status)).toBe(false);
    }
  });
});
