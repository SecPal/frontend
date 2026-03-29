// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  isPublicLoggedOutPath,
  normalizeAppPathname,
  resolveOfflineProtectedRouteRedirect,
} from "./offlineNavigationAccess";

describe("offlineNavigationAccess", () => {
  it("normalizes trailing slashes for app routes", () => {
    expect(normalizeAppPathname("/profile/")).toBe("/profile");
    expect(normalizeAppPathname("/")).toBe("/");
  });

  it("treats login and onboarding completion as public logged-out routes", () => {
    expect(isPublicLoggedOutPath("/login")).toBe(true);
    expect(isPublicLoggedOutPath("/login/")).toBe(true);
    expect(isPublicLoggedOutPath("/onboarding/complete")).toBe(true);
    expect(isPublicLoggedOutPath("/profile")).toBe(false);
  });

  it("redirects offline protected routes to login after logout", () => {
    expect(resolveOfflineProtectedRouteRedirect("/profile", false)).toBe(
      "/login"
    );
    expect(resolveOfflineProtectedRouteRedirect("/settings", false)).toBe(
      "/login"
    );
    expect(resolveOfflineProtectedRouteRedirect("/login", false)).toBeNull();
  });

  it("does not force a redirect when auth state is unknown or authenticated", () => {
    expect(resolveOfflineProtectedRouteRedirect("/profile", null)).toBeNull();
    expect(resolveOfflineProtectedRouteRedirect("/profile", true)).toBeNull();
  });
});
