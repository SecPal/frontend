// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

const PUBLIC_LOGGED_OUT_PATHS = new Set(["/login", "/onboarding/complete"]);

export function normalizeAppPathname(pathname: string): string {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPublicLoggedOutPath(pathname: string): boolean {
  return PUBLIC_LOGGED_OUT_PATHS.has(normalizeAppPathname(pathname));
}

export function resolveOfflineProtectedRouteRedirect(
  pathname: string,
  isAuthenticated: boolean | null
): string | null {
  if (isAuthenticated !== false) {
    return null;
  }

  return isPublicLoggedOutPath(pathname) ? null : "/login";
}
