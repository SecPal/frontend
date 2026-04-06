// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { EmailVerificationGate } from "./EmailVerificationGate";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteLoadingState,
} from "./RouteGuardState";

interface OrganizationalRouteProps {
  children: React.ReactNode;
}

/**
 * OrganizationalRoute protects routes that require organizational access.
 * It checks both authentication and organizational permissions.
 */
export function OrganizationalRoute({ children }: OrganizationalRouteProps) {
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isLoading,
    hasOrganizationalAccess,
    logout,
    retryBootstrap,
    user,
  } = useAuth();

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

  return (
    <EmailVerificationGate
      user={user}
      onRetry={retryBootstrap}
      onSignInAgain={logout}
    >
      {() => {
        if (!hasOrganizationalAccess()) {
          return <RouteAccessDeniedState />;
        }

        return <>{children}</>;
      }}
    </EmailVerificationGate>
  );
}
