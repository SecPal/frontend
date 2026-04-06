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

export function AppAccessRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  if (isPreContractUser(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

export function OnboardingOnlyRoute({ children }: OnboardingAccessRouteProps) {
  const { user } = useAuth();

  if (isPreContractUser(user)) {
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}
