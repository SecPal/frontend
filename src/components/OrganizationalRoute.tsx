// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { EmailVerificationGate } from "./EmailVerificationGate";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteLoadingState,
  RouteVaultLockedState,
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
    isVaultLocked = false,
    hasOrganizationalAccess,
    logout,
    retryBootstrap,
    unlock,
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
        if (!hasOrganizationalAccess()) {
          return <RouteAccessDeniedState />;
        }

        return <>{children}</>;
      }}
    </EmailVerificationGate>
  );
}
