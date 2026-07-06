// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authStorage } from "../services/storage";
import { EmailVerificationGate } from "./EmailVerificationGate";
import {
  isRouteAuthBootstrapPending,
  isRouteAuthSnapshotRevalidating,
} from "./routeGuardAuth";
import { LoginRouteLoadingState } from "./LoginRouteState";
import {
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

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Optional placeholder rendered in the content slot while a stored session
   * snapshot is being revalidated (`isLoading && user !== null`). Rendered
   * inside `EmailVerificationGate`, so unverified persisted users still see
   * the verification screen instead of the placeholder.
   */
  revalidatingFallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  revalidatingFallback,
}: ProtectedRouteProps) {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isPrivacyShielded = false,
    isVaultLocked = false,
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isRevalidating = isRouteAuthSnapshotRevalidating(auth);
  const protectedContent =
    isRevalidating && revalidatingFallback !== undefined
      ? revalidatingFallback
      : children;

  return (
    <EmailVerificationGate
      user={user}
      onRetry={retryBootstrap}
      onSignInAgain={logout}
    >
      <RoutePrivacyShieldState
        isActive={isPrivacyShieldState(routeSensitiveUiState)}
        onDismiss={hidePrivacyShield ?? (() => {})}
      >
        {protectedContent}
      </RoutePrivacyShieldState>
    </EmailVerificationGate>
  );
}
