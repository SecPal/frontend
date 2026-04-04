// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import type { RestrictedFeature, UserCapabilities } from "../lib/capabilities";
import { useAuth } from "../hooks/useAuth";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteEmailVerificationState,
  RouteLoadingState,
} from "./RouteGuardState";

interface FeatureRouteProps {
  children: React.ReactNode;
  feature: RestrictedFeature;
  fallbackPath?: string;
  missingFeatureElement?: React.ReactNode;
  requiredAction?: (capabilities: UserCapabilities) => boolean;
  deniedActionElement?: React.ReactNode;
}

export function FeatureRoute({
  children,
  feature,
  fallbackPath,
  missingFeatureElement = <RouteAccessDeniedState />,
  requiredAction,
  deniedActionElement = <RouteAccessDeniedState />,
}: FeatureRouteProps) {
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isLoading,
    logout,
    retryBootstrap,
    user,
  } = useAuth();
  const capabilities = useUserCapabilities();

  if (isLoading) {
    return <RouteLoadingState />;
  }

  if (bootstrapRecoveryReason) {
    return (
      <RouteBootstrapRecoveryState
        onRetry={retryBootstrap}
        onSignInAgain={logout}
        reason={bootstrapRecoveryReason}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.emailVerified === false) {
    return (
      <RouteEmailVerificationState
        email={user.email}
        onRetry={retryBootstrap}
        onSignInAgain={logout}
      />
    );
  }

  if (!capabilities[feature]) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return <>{missingFeatureElement}</>;
  }

  if (requiredAction && !requiredAction(capabilities)) {
    return <>{deniedActionElement}</>;
  }

  return <>{children}</>;
}
