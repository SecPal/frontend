// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface PermissionRouteProps {
  children: React.ReactNode;
  permission: string;
  fallbackPath?: string;
}

/**
 * PermissionRoute Component
 *
 * Protects routes by requiring a specific permission.
 * Redirects to fallback path (default: "/") if permission is missing.
 *
 * @example
 * <PermissionRoute permission="activity_log.read">
 *   <ActivityLogList />
 * </PermissionRoute>
 */
export function PermissionRoute({
  children,
  permission,
  fallbackPath = "/",
}: PermissionRouteProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!hasPermission(permission)) {
    // Show error message briefly then redirect
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}
