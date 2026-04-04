// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  RouteBootstrapRecoveryState,
  RouteEmailVerificationState,
  RouteLoadingState,
} from "./RouteGuardState";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const {
    bootstrapRecoveryReason,
    isAuthenticated,
    isLoading,
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

  if (user?.emailVerified === false) {
    return (
      <RouteEmailVerificationState
        email={user.email}
        onRetry={retryBootstrap}
        onSignInAgain={logout}
      />
    );
  }

  return <>{children}</>;
}
