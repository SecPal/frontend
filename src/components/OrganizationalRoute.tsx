// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { EmailVerificationGate } from "./EmailVerificationGate";
import {
  isRouteAuthBootstrapPending,
  isRouteAuthSnapshotRevalidating,
} from "./routeGuardAuth";
import {
  RouteAccessDeniedState,
  RouteBootstrapRecoveryState,
  RouteLoadingState,
  RoutePrivacyShieldState,
  RouteVaultLockedState,
} from "./RouteGuardState";
import {
  getSensitiveUiState,
  isPrivacyShieldState,
  isVaultLockedState,
} from "../lib/sensitiveUiState";

interface OrganizationalRouteProps {
  children: React.ReactNode;
  /**
   * Optional placeholder rendered in the content slot while a stored session
   * snapshot is being revalidated (`isLoading && user !== null`). Rendered
   * inside `EmailVerificationGate`, so unverified persisted users still see
   * the verification screen instead of the placeholder.
   */
  revalidatingFallback?: React.ReactNode;
}

/**
 * OrganizationalRoute protects routes that require organizational access.
 * It checks both authentication and organizational permissions.
 */
export function OrganizationalRoute({
  children,
  revalidatingFallback,
}: OrganizationalRouteProps) {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isPrivacyShielded = false,
    isVaultLocked = false,
    hasOrganizationalAccess,
    hidePrivacyShield,
    logout,
    retryBootstrap,
    sensitiveUiState,
    unlock,
    user,
  } = auth;
  const routeSensitiveUiState =
    sensitiveUiState ??
    getSensitiveUiState({
      isPrivacyShieldVisible: isPrivacyShielded,
      isVaultLocked,
    });

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

  if (isVaultLockedState(routeSensitiveUiState)) {
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

  const isRevalidating = isRouteAuthSnapshotRevalidating(auth);

  return (
    <RoutePrivacyShieldState
      isActive={isPrivacyShieldState(routeSensitiveUiState)}
      onDismiss={hidePrivacyShield ?? (() => {})}
    >
      <EmailVerificationGate
        user={user}
        onRetry={retryBootstrap}
        onSignInAgain={logout}
      >
        {() => {
          if (isRevalidating && revalidatingFallback !== undefined) {
            return <>{revalidatingFallback}</>;
          }

          const content = !hasOrganizationalAccess() ? (
            <RouteAccessDeniedState />
          ) : (
            <>{children}</>
          );

          return content;
        }}
      </EmailVerificationGate>
    </RoutePrivacyShieldState>
  );
}
