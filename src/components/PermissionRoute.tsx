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
  RouteVaultLockedState,
} from "./RouteGuardState";

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: string;
  fallbackPath?: string;
  /**
   * Optional placeholder rendered in the content slot while a stored session
   * snapshot is being revalidated (`isLoading && user !== null`). Rendered
   * inside `EmailVerificationGate`, so unverified persisted users still see
   * the verification screen instead of the placeholder.
   */
  revalidatingFallback?: React.ReactNode;
}

/**
 * PermissionRoute Component
 *
 * Protects routes by requiring a specific permission.
 * Shows a consistent access denied state by default and only redirects when an
 * explicit fallback path is provided.
 *
 * @example
 * <PermissionRoute permission="activity_log.read">
 *   <ActivityLogList />
 * </PermissionRoute>
 */
export function PermissionRoute({
  children,
  permission,
  fallbackPath,
  revalidatingFallback,
}: PermissionRouteProps) {
  const auth = useAuth();
  const {
    bootstrapRecoveryReason,
    hasPermission,
    isAuthenticated,
    isVaultLocked = false,
    logout,
    retryBootstrap,
    unlock,
    user,
  } = auth;

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

        if (!hasPermission(permission)) {
          if (fallbackPath) {
            return <Navigate to={fallbackPath} replace />;
          }

          return <RouteAccessDeniedState />;
        }

        return <>{children}</>;
      }}
    </EmailVerificationGate>
  );
}
