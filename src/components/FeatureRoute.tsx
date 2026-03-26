// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import type { RestrictedFeature } from "../lib/capabilities";
import { useAuth } from "../hooks/useAuth";
import { useUserCapabilities } from "../hooks/useUserCapabilities";
import { RouteAccessDeniedState, RouteLoadingState } from "./RouteGuardState";

interface FeatureRouteProps {
  children: React.ReactNode;
  feature: RestrictedFeature;
  fallbackPath?: string;
}

export function FeatureRoute({
  children,
  feature,
  fallbackPath,
}: FeatureRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const capabilities = useUserCapabilities();

  if (isLoading) {
    return <RouteLoadingState />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!capabilities[feature]) {
    if (fallbackPath) {
      return <Navigate to={fallbackPath} replace />;
    }

    return <RouteAccessDeniedState />;
  }

  return <>{children}</>;
}
