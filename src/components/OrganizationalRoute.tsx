// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Navigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { useAuth } from "../hooks/useAuth";
import { Text } from "./text";

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
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-lg">
          <Trans>Loading...</Trans>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasOrganizationalAccess()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <Text className="text-lg font-semibold mb-2">
            <Trans>Access Denied</Trans>
          </Text>
          <Text className="text-zinc-500 dark:text-zinc-400">
            <Trans>
              You do not have permission to access this feature. Contact your
              administrator if you believe this is an error.
            </Trans>
          </Text>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
