// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import type { RestrictedFeature, UserCapabilities } from "../lib/capabilities";
import { useAuth } from "../hooks/useAuth";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { EmailVerificationGate } from "./EmailVerificationGate";
import { isRouteAuthBootstrapPending } from "./routeGuardAuth";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteLoadingState,
  RouteVaultLockedState,
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
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
    user,
  } = auth;
  const capabilities = useUserCapabilities();

  if (isRouteAuthBootstrapPending(auth)) {
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

  if (isVaultLocked) {
    return (
      <RouteVaultLockedState
        onUnlock={unlock ?? (async () => false)}
        onSignInAgain={logout}
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <EmailVerificationGate
      user={user}
      onRetry={retryBootstrap}
      onSignInAgain={logout}
    >
      {() => {
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
      }}
    </EmailVerificationGate>
  );
}
