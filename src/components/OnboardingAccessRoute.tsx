// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface OnboardingAccessRouteProps {
  children: React.ReactNode;
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

export function AppAccessRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  if (isPreContractUser(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function OnboardingOnlyRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  // Allow access when employee status is unknown (offline / stale persisted
  // user): a pre-contract user who cannot reach the API should stay at
  // /onboarding rather than be bounced to /.
  if (!hasKnownEmployeeStatus(user) || isPreContractUser(user)) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
