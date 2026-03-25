// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  RouteAccessDeniedState,
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
  const { isAuthenticated, isLoading, hasOrganizationalAccess } = useAuth();

  if (isLoading) {
    return <RouteLoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasOrganizationalAccess()) {
    return <RouteAccessDeniedState />;
  }

  return <>{children}</>;
}
