// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTestUser,
  describeAuthResolutionState,
  describeLoginBlockingState,
  getConfiguredTestUserOrThrow,
  getAuthStateCachePath,
  isRemoteE2ETarget,
  type LoginSubmitState,
} from "./e2e/auth-helpers";

/**
 * Mocks process.cwd() to a path that does not match the Polyscope clone
 * pattern, so tests that verify non-Polyscope behaviour are not affected by
 * the directory this test suite is executed from.
 */
function mockNonPolyscopeCwd() {
  return vi.spyOn(process, "cwd").mockReturnValue("/home/runner/work/frontend");
}

describe("auth E2E helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("isRemoteE2ETarget", () => {
    it("treats https targets as remote", () => {
      expect(isRemoteE2ETarget("https://app.secpal.dev")).toBe(true);
      expect(isRemoteE2ETarget("https://velvet-zebra.preview.secpal.dev")).toBe(
        true
      );
    });

    it("treats an explicit localhost target as non-remote", () => {
      expect(isRemoteE2ETarget("http://localhost:5173")).toBe(false);
      expect(isRemoteE2ETarget("https://localhost:5173")).toBe(false);
      expect(isRemoteE2ETarget("https://frontend.ddev.site")).toBe(false);
    });

    it("treats the implicit default as non-remote when no Polyscope workspace is active", () => {
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      vi.stubEnv("POLYSCOPE_WORKSPACE", "");
      mockNonPolyscopeCwd();

      expect(isRemoteE2ETarget(undefined)).toBe(false);
    });

    it("treats the implicit default as remote when a Polyscope workspace is active", () => {
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

      expect(isRemoteE2ETarget(undefined)).toBe(true);
    });
  });

  describe("buildTestUser", () => {
    it("uses local development defaults for non-remote targets", () => {
      expect(buildTestUser({}, undefined)).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("keeps the current Polyscope workspace preview credentials even when other remote targets are configured", () => {
      expect(
        buildTestUser({
          PLAYWRIGHT_BASE_URL: "https://app.secpal.dev",
          PLAYWRIGHT_API_BASE_URL: "https://api.secpal.dev",
          POLYSCOPE_WORKSPACE: "grumpy-lynx",
        })
      ).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("keeps workspace preview targets on the default preview credentials", () => {
      expect(buildTestUser({ POLYSCOPE_WORKSPACE: "grumpy-lynx" })).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("keeps generic workspace preview hosts on the default preview credentials", () => {
      expect(
        buildTestUser({}, "https://grumpy-lynx.preview.secpal.dev")
      ).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("uses the standard seeded onboarding user for workspace preview targets when live onboarding is enabled", () => {
      expect(
        buildTestUser(
          { PLAYWRIGHT_LIVE_ONBOARDING: "1" },
          "https://grumpy-lynx.preview.secpal.dev"
        )
      ).toEqual({
        email: "onboarding@example.com",
        password: "password",
      });
    });

    it("throws when targeting a non-workspace remote without TEST_USER_*", () => {
      // Pure live targets such as `app.secpal.dev` are not part of the
      // Polyscope E2E surface (issue #1199). Silently injecting seeded dev
      // credentials against an arbitrary production host is a security risk.
      expect(() =>
        buildTestUser({}, "https://app.secpal.dev")
      ).toThrow("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
    });

    it("throws when targeting a non-workspace remote with live onboarding but no TEST_USER_*", () => {
      expect(() =>
        buildTestUser(
          { PLAYWRIGHT_LIVE_ONBOARDING: "1" },
          "https://app.secpal.dev"
        )
      ).toThrow("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
    });

    it("prefers explicitly configured credentials for remote targets", () => {
      expect(
        buildTestUser(
          {
            TEST_USER_EMAIL: "guard@secpal.dev",
            TEST_USER_PASSWORD: "correct horse battery staple",
          },
          "https://app.secpal.dev"
        )
      ).toEqual({
        email: "guard@secpal.dev",
        password: "correct horse battery staple",
      });
    });

    it("prefers explicitly configured credentials with live onboarding flag", () => {
      expect(
        buildTestUser(
          {
            TEST_USER_EMAIL: "guard@secpal.dev",
            TEST_USER_PASSWORD: "correct horse battery staple",
            PLAYWRIGHT_LIVE_ONBOARDING: "1",
          },
          "https://app.secpal.dev"
        )
      ).toEqual({
        email: "guard@secpal.dev",
        password: "correct horse battery staple",
      });
    });
  });

  describe("describeLoginBlockingState", () => {
    it("explains health-gated login states", () => {
      const state: LoginSubmitState = {
        disabled: true,
        ariaDisabled: "true",
        text: "Checking system...",
        healthWarning: "System not ready",
        offlineWarning: null,
        lockoutWarning: null,
        error: null,
      };

      expect(describeLoginBlockingState(state)).toContain("health gate");
    });

    it("explains offline login states", () => {
      const state: LoginSubmitState = {
        disabled: true,
        ariaDisabled: "true",
        text: "Log in",
        healthWarning: null,
        offlineWarning: "No internet connection",
        lockoutWarning: null,
        error: null,
      };

      expect(describeLoginBlockingState(state)).toContain("offline gate");
    });

    it("explains rate-limit lockout states", () => {
      const state: LoginSubmitState = {
        disabled: true,
        ariaDisabled: "true",
        text: "Log in",
        healthWarning: null,
        offlineWarning: null,
        lockoutWarning: "Too many attempts. Try again in 10 minutes.",
        error: null,
      };

      expect(describeLoginBlockingState(state)).toContain("lockout");
    });

    it("explains login-error blocking states", () => {
      const state: LoginSubmitState = {
        disabled: true,
        ariaDisabled: "true",
        text: "Log in",
        healthWarning: null,
        offlineWarning: null,
        lockoutWarning: null,
        error: "Invalid credentials",
      };

      expect(describeLoginBlockingState(state)).toContain("visible error");
    });

    it("returns null when the submit button is actionable", () => {
      const state: LoginSubmitState = {
        disabled: false,
        ariaDisabled: "false",
        text: "Log in",
        healthWarning: null,
        offlineWarning: null,
        lockoutWarning: null,
        error: null,
      };

      expect(describeLoginBlockingState(state)).toBeNull();
    });
  });

  describe("getConfiguredTestUserOrThrow", () => {
    it("returns the default credentials when the current Polyscope workspace overrides other remote targets", () => {
      const result = getConfiguredTestUserOrThrow({
        PLAYWRIGHT_BASE_URL: "https://app.secpal.dev",
        PLAYWRIGHT_API_BASE_URL: "https://api.secpal.dev",
        POLYSCOPE_WORKSPACE: "grumpy-lynx",
      });

      expect(result).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("returns the default credentials for workspace preview targets", () => {
      const result = getConfiguredTestUserOrThrow({
        POLYSCOPE_WORKSPACE: "grumpy-lynx",
      });

      expect(result).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("returns the default credentials for generic workspace preview hosts", () => {
      const result = getConfiguredTestUserOrThrow(
        { PLAYWRIGHT_BASE_URL: "https://grumpy-lynx.preview.secpal.dev" },
        "https://grumpy-lynx.preview.secpal.dev"
      );

      expect(result).toEqual({
        email: "test@example.com",
        password: "password",
      });
    });

    it("returns credentials when targeting a remote environment with credentials set", () => {
      const result = getConfiguredTestUserOrThrow(
        {
          TEST_USER_EMAIL: "guard@secpal.dev",
          TEST_USER_PASSWORD: "correct-horse-battery-staple",
          PLAYWRIGHT_BASE_URL: "https://app.secpal.dev",
        },
        "https://app.secpal.dev"
      );

      expect(result).toEqual({
        email: "guard@secpal.dev",
        password: "correct-horse-battery-staple",
      });
    });

    it("throws when targeting a non-workspace remote without TEST_USER_*", () => {
      // Pure live targets such as `app.secpal.dev` are not part of the
      // Polyscope E2E surface (issue #1199); silently injecting seeded dev
      // credentials against a production host is a security risk.
      expect(() =>
        getConfiguredTestUserOrThrow(
          { PLAYWRIGHT_BASE_URL: "https://app.secpal.dev" },
          "https://app.secpal.dev"
        )
      ).toThrow("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
    });

    it("returns the standard onboarding user for remote live onboarding without TEST_USER_*", () => {
      const result = getConfiguredTestUserOrThrow(
        {
          PLAYWRIGHT_BASE_URL: "https://app.secpal.dev",
          PLAYWRIGHT_LIVE_ONBOARDING: "1",
        },
        "https://app.secpal.dev"
      );

      expect(result).toEqual({
        email: "onboarding@example.com",
        password: "password",
      });
    });

    it("returns the standard onboarding user for workspace preview live onboarding without TEST_USER_*", () => {
      const result = getConfiguredTestUserOrThrow(
        {
          PLAYWRIGHT_BASE_URL: "https://grumpy-lynx.preview.secpal.dev",
          PLAYWRIGHT_LIVE_ONBOARDING: "1",
        },
        "https://grumpy-lynx.preview.secpal.dev"
      );

      expect(result).toEqual({
        email: "onboarding@example.com",
        password: "password",
      });
    });
  });

  describe("getAuthStateCachePath", () => {
    it("separates auth cache files by remote target host", () => {
      expect(
        getAuthStateCachePath(
          { email: "guard@secpal.dev", password: "secret" },
          "https://app.secpal.dev"
        )
      ).not.toBe(
        getAuthStateCachePath(
          { email: "guard@secpal.dev", password: "secret" },
          "https://velvet-zebra.preview.secpal.dev"
        )
      );
    });

    it("separates auth cache files by configured user", () => {
      expect(
        getAuthStateCachePath(
          { email: "guard@secpal.dev", password: "secret" },
          "https://app.secpal.dev"
        )
      ).not.toBe(
        getAuthStateCachePath(
          { email: "onboarding@example.com", password: "password" },
          "https://app.secpal.dev"
        )
      );
    });

    it("separates auth cache files for different localhost ports", () => {
      expect(
        getAuthStateCachePath(
          { email: "test@example.com", password: "password" },
          "http://localhost:5173"
        )
      ).not.toBe(
        getAuthStateCachePath(
          { email: "test@example.com", password: "password" },
          "http://localhost:4173"
        )
      );
    });

    it("separates auth cache files for ddev and localhost targets", () => {
      expect(
        getAuthStateCachePath(
          { email: "test@example.com", password: "password" },
          "https://frontend.ddev.site"
        )
      ).not.toBe(
        getAuthStateCachePath(
          { email: "test@example.com", password: "password" },
          "http://localhost:5173"
        )
      );
    });
  });

  describe("describeAuthResolutionState", () => {
    it("returns authenticated when the user menu is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/",
          hasUserMenu: true,
          hasOnboardingShell: false,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("authenticated");
    });

    it("returns authenticated when the pre-contract onboarding shell is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/onboarding",
          hasUserMenu: false,
          hasOnboardingShell: true,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("authenticated");
    });

    it("returns login when the app resolved to the login route", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/login",
          hasUserMenu: false,
          hasOnboardingShell: false,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("login");
    });

    it("returns recovery when the protected-route bootstrap recovery screen is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/customers",
          hasUserMenu: false,
          hasOnboardingShell: false,
          hasBootstrapRecoveryScreen: true,
        })
      ).toBe("recovery");
    });

    it("returns unresolved while neither login nor authenticated shell is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/",
          hasUserMenu: false,
          hasOnboardingShell: false,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("unresolved");
    });
  });
});
