// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { RouteAccessDeniedState, RouteLoadingState } from "./RouteGuardState";

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: string;
  fallbackPath?: string;
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
}: PermissionRouteProps) {
  const { hasPermission, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <RouteLoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(permission)) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return <RouteAccessDeniedState />;
  }

  return <>{children}</>;
}
