// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  getAuthOnboardingWorkflowStatus,
  isSubmittedOnboardingWorkflowStatus,
} from "../lib/onboardingWorkflow";

interface OnboardingAccessRouteProps {
  children: React.ReactNode;
}

interface OnboardingRedirectState {
  onboardingRequired?: boolean;
  returnTo?: string;
}

function isPreContractUser(user: ReturnType<typeof useAuth>["user"]): boolean {
  return (
    user?.employee?.status === "pre_contract" ||
    user?.employeeStatus === "pre_contract"
  );
}

/**
 * Returns false only when employee lifecycle state is still unknown. Persisted
 * auth users may omit the full employee record offline, but they retain the
 * minimal employeeStatus field needed for route gating.
 */
function hasKnownEmployeeStatus(
  user: ReturnType<typeof useAuth>["user"]
): boolean {
  return (
    user != null &&
    (user.employee !== undefined || user.employeeStatus !== undefined)
  );
}

function buildReturnTo(
  pathname: string,
  search: string,
  hash: string
): string | null {
  const target = `${pathname}${search}${hash}`;

  if (!target.startsWith("/")) {
    return null;
  }

  return target;
}

function getSafeOnboardingReturnTarget(state: unknown): string | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  const returnTo = (state as OnboardingRedirectState).returnTo;

  if (typeof returnTo !== "string" || !returnTo.startsWith("/")) {
    return null;
  }

  return returnTo;
}

export function AppAccessRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();
  const location = useLocation();
  const onboardingWorkflowStatus = getAuthOnboardingWorkflowStatus(user);

  if (isPreContractUser(user)) {
    return (
      <Navigate
        to={
          isSubmittedOnboardingWorkflowStatus(onboardingWorkflowStatus)
            ? "/onboarding/submitted"
            : "/onboarding"
        }
        replace
        state={{
          onboardingRequired: true,
          returnTo: buildReturnTo(
            location.pathname,
            location.search,
            location.hash
          ),
        }}
      />
    );
  }

  return <>{children}</>;
}

export function OnboardingOnlyRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();
  const location = useLocation();

  // Allow access when employee status is unknown (offline / stale persisted
  // user): a pre-contract user who cannot reach the API should stay at
  // /onboarding rather than be bounced to /.
  if (!hasKnownEmployeeStatus(user) || isPreContractUser(user)) {
    return <>{children}</>;
  }

  return (
    <Navigate
      to={getSafeOnboardingReturnTarget(location.state) ?? "/"}
      replace
    />
  );
}
