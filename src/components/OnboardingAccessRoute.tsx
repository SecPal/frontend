// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface OnboardingAccessRouteProps {
  children: React.ReactNode;
}

function isPreContractUser(user: ReturnType<typeof useAuth>["user"]): boolean {
  return user?.employee?.status === "pre_contract";
}

/**
 * Returns false when employee status is not yet known (e.g. offline with a
 * stale persisted user that has no employee record loaded). The persisted
 * auth user intentionally omits employee data; bootstrap revalidation
 * populates it. Until then, employee === undefined, which is distinct from
 * null (confirmed non-employee).
 */
function hasKnownEmployeeStatus(
  user: ReturnType<typeof useAuth>["user"]
): boolean {
  return user != null && user.employee !== undefined;
}

export function AppAccessRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  // Redirect pre-contract users AND users whose employee status is not yet
  // known to /onboarding. This prevents a pre-contract user from accessing
  // normal app routes in an offline or bootstrap-timeout scenario where
  // the persisted user lacks employee data.
  if (!hasKnownEmployeeStatus(user) || isPreContractUser(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function OnboardingOnlyRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  // Allow access when status is unknown (offline / stale persisted user) as
  // a safe default: a pre-contract user who cannot reach the API should
  // stay at /onboarding rather than be bounced to /.
  if (!hasKnownEmployeeStatus(user) || isPreContractUser(user)) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
