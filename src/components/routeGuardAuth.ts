// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { AuthContextType } from "../contexts/auth-context";

type RouteAuthBootstrapState = Pick<AuthContextType, "isLoading" | "user">;

export function isRouteAuthBootstrapPending({
  isLoading,
  user,
}: RouteAuthBootstrapState) {
  return isLoading && user === null;
}

export function isRouteAuthSnapshotRevalidating({
  isLoading,
  user,
}: RouteAuthBootstrapState) {
  return isLoading && user !== null;
}
