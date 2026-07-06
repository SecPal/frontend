// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Navigate } from "react-router-dom";
import type { RestrictedFeature, UserCapabilities } from "../lib/capabilities";
import { useAuth } from "../hooks/useAuth";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { authStorage } from "../services/storage";
import { EmailVerificationGate } from "./EmailVerificationGate";
import {
  isRouteAuthBootstrapPending,
  isRouteAuthSnapshotRevalidating,
} from "./routeGuardAuth";
import { LoginRouteLoadingState } from "./LoginRouteState";
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

interface FeatureRouteProps {
  children: React.ReactNode;
  feature: RestrictedFeature;
  fallbackPath?: string;
  missingFeatureElement?: React.ReactNode;
  requiredAction?: (capabilities: UserCapabilities) => boolean;
  deniedActionElement?: React.ReactNode;
  /**
   * Optional placeholder rendered in the content slot while a stored session
   * snapshot is being revalidated (`isLoading && user !== null`). Rendered
   * inside `EmailVerificationGate`, so unverified persisted users still see
   * the verification screen instead of the placeholder.
   */
  revalidatingFallback?: React.ReactNode;
}

export function FeatureRoute({
  children,
  feature,
  fallbackPath,
  missingFeatureElement = <RouteAccessDeniedState />,
  requiredAction,
  deniedActionElement = <RouteAccessDeniedState />,
  revalidatingFallback,
}: FeatureRouteProps) {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isVaultLocked = false,
    hidePrivacyShield,
    logout,
    retryBootstrap,
    sensitiveUiState,
    unlock,
    user,
  } = auth;
  const capabilities = useUserCapabilities();
  const routeSensitiveUiState =
    sensitiveUiState ??
    getSensitiveUiState({
      isVaultLocked,
    });

  if (isRouteAuthBootstrapPending(auth)) {
    if (!authStorage.hasStoredUser()) {
      return <LoginRouteLoadingState />;
    }

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

  if (isPrivacyShieldState(routeSensitiveUiState)) {
    return (
      <RoutePrivacyShieldState onDismiss={hidePrivacyShield ?? (() => {})} />
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isRevalidating = isRouteAuthSnapshotRevalidating(auth);

  return (
    <EmailVerificationGate
      user={user}
      onRetry={retryBootstrap}
      onSignInAgain={logout}
    >
      {() => {
        if (isRevalidating && revalidatingFallback !== undefined) {
          return <>{revalidatingFallback}</>;
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
      }}
    </EmailVerificationGate>
  );
}
