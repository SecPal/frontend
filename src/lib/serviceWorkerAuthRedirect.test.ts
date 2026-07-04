// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it, vi } from "vitest";
import {
  redirectProtectedWindowClientsToLogin,
  shouldRedirectLoggedOutNavigation,
  type RedirectableWindowClient,
} from "./serviceWorkerAuthRedirect";

function createWindowClient(
  url: string,
  navigateImpl: RedirectableWindowClient["navigate"] = vi
    .fn<RedirectableWindowClient["navigate"]>()
    .mockResolvedValue(null)
): RedirectableWindowClient {
  return {
    url,
    navigate: navigateImpl,
  };
}

describe("serviceWorkerAuthRedirect", () => {
  describe("shouldRedirectLoggedOutNavigation", () => {
    it("does not redirect when auth state is unknown or authenticated", () => {
      expect(shouldRedirectLoggedOutNavigation("/dashboard", true)).toBe(false);
      expect(shouldRedirectLoggedOutNavigation("/dashboard", null)).toBe(false);
    });

    it("allows logged-out public paths, including trailing-slash variants", () => {
      expect(shouldRedirectLoggedOutNavigation("/login", false)).toBe(false);
      expect(shouldRedirectLoggedOutNavigation("/login/", false)).toBe(false);
      expect(shouldRedirectLoggedOutNavigation("/source", false)).toBe(false);
      expect(shouldRedirectLoggedOutNavigation("/source/", false)).toBe(false);
      expect(
        shouldRedirectLoggedOutNavigation("/onboarding/complete/", false)
      ).toBe(false);
    });

    it("redirects logged-out protected paths", () => {
      expect(shouldRedirectLoggedOutNavigation("/", false)).toBe(true);
      expect(shouldRedirectLoggedOutNavigation("/dashboard", false)).toBe(true);
    });
  });

  describe("redirectProtectedWindowClientsToLogin", () => {
    it("redirects only protected window clients to the login page", async () => {
      const protectedNavigate = vi
        .fn<RedirectableWindowClient["navigate"]>()
        .mockResolvedValue(null);
      const loginNavigate = vi
        .fn<RedirectableWindowClient["navigate"]>()
        .mockResolvedValue(null);

      const summary = await redirectProtectedWindowClientsToLogin(
        [
          createWindowClient(
            "https://app.secpal.dev/dashboard",
            protectedNavigate
          ),
          createWindowClient("https://app.secpal.dev/login", loginNavigate),
        ],
        "https://app.secpal.dev"
      );

      expect(protectedNavigate).toHaveBeenCalledWith(
        "https://app.secpal.dev/login"
      );
      expect(loginNavigate).not.toHaveBeenCalled();
      expect(summary).toEqual({ redirected: 1, skipped: 1, failed: 0 });
    });

    it("continues redirecting remaining clients when one navigation fails", async () => {
      const logger = {
        error: vi.fn<Console["error"]>(),
        warn: vi.fn<Console["warn"]>(),
      };
      const failedNavigate = vi
        .fn<RedirectableWindowClient["navigate"]>()
        .mockRejectedValue(new Error("navigation failed"));
      const successfulNavigate = vi
        .fn<RedirectableWindowClient["navigate"]>()
        .mockResolvedValue(null);

      const summary = await redirectProtectedWindowClientsToLogin(
        [
          createWindowClient("https://app.secpal.dev/reports", failedNavigate),
          createWindowClient(
            "https://app.secpal.dev/settings",
            successfulNavigate
          ),
          createWindowClient(
            "https://app.secpal.dev/login",
            successfulNavigate
          ),
        ],
        "https://app.secpal.dev",
        logger
      );

      expect(failedNavigate).toHaveBeenCalledWith(
        "https://app.secpal.dev/login"
      );
      expect(successfulNavigate).toHaveBeenCalledWith(
        "https://app.secpal.dev/login"
      );
      expect(successfulNavigate).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "[SW] Failed to redirect protected client to login:",
        expect.objectContaining({
          clientUrl: "https://app.secpal.dev/reports",
          error: expect.any(Error),
        })
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "[SW] Completed protected-client login redirects with failures:",
        {
          redirected: 1,
          skipped: 1,
          failed: 1,
        }
      );
      expect(summary).toEqual({ redirected: 1, skipped: 1, failed: 1 });
    });

    it("redacts query strings and fragments from logged client URLs", async () => {
      const logger = {
        error: vi.fn<Console["error"]>(),
        warn: vi.fn<Console["warn"]>(),
      };
      const failedNavigate = vi
        .fn<RedirectableWindowClient["navigate"]>()
        .mockRejectedValue(new Error("navigation failed"));

      await redirectProtectedWindowClientsToLogin(
        [
          createWindowClient(
            "https://app.secpal.dev/reports?token=secret#filters",
            failedNavigate
          ),
        ],
        "https://app.secpal.dev",
        logger
      );

      expect(logger.error).toHaveBeenCalledWith(
        "[SW] Failed to redirect protected client to login:",
        expect.objectContaining({
          clientUrl: "https://app.secpal.dev/reports",
          error: expect.any(Error),
        })
      );
    });
  });
});
