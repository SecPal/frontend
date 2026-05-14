// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmployeeOnboardingWorkflowStatus } from "@/types/api";
import type { User } from "../contexts/auth-context";

export const SUBMITTED_ONBOARDING_WORKFLOW_STATUSES = new Set<
  EmployeeOnboardingWorkflowStatus
>([
  "submitted_for_review",
  "contract_confirmed",
  "ready_for_activation",
  "active",
]);

export function getAuthOnboardingWorkflowStatus(
  user: User | null | undefined
): EmployeeOnboardingWorkflowStatus | undefined {
  const direct = user?.onboardingWorkflowStatus;
  if (direct) {
    return direct;
  }

  const nested = user?.employee?.onboarding_workflow?.status;
  return typeof nested === "string"
    ? (nested as EmployeeOnboardingWorkflowStatus)
    : undefined;
}

export function isSubmittedOnboardingWorkflowStatus(
  status: EmployeeOnboardingWorkflowStatus | undefined
): boolean {
  return status !== undefined && SUBMITTED_ONBOARDING_WORKFLOW_STATUSES.has(status);
}
