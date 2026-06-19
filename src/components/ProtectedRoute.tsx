// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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
  RouteVaultLockedState,
} from "./RouteGuardState";

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
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
    user,
  } = auth;

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

  const isRevalidating = isRouteAuthSnapshotRevalidating(auth);

  return (
    <EmailVerificationGate
      user={user}
      onRetry={retryBootstrap}
      onSignInAgain={logout}
    >
      {isRevalidating && revalidatingFallback !== undefined
        ? revalidatingFallback
        : children}
    </EmailVerificationGate>
  );
}
