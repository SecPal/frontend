// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  buildTestUser,
  describeAuthResolutionState,
  describeLoginBlockingState,
  getConfiguredTestUserOrThrow,
  isRemoteE2ETarget,
  type LoginSubmitState,
} from "./e2e/auth-helpers";

describe("auth E2E helpers", () => {
  describe("isRemoteE2ETarget", () => {
    it("treats https targets as remote", () => {
      expect(isRemoteE2ETarget("https://app.secpal.dev")).toBe(true);
    });

    it("treats local and missing targets as non-remote", () => {
      expect(isRemoteE2ETarget("http://localhost:5173")).toBe(false);
      expect(isRemoteE2ETarget(undefined)).toBe(false);
    });
  });

  describe("buildTestUser", () => {
    it("uses local development defaults for non-remote targets", () => {
      expect(buildTestUser({}, undefined)).toEqual({
        email: "test@secpal.dev",
        password: "password",
      });
    });

    it("requires explicit credentials for remote targets", () => {
      expect(buildTestUser({}, "https://app.secpal.dev")).toEqual({
        email: "",
        password: "",
      });
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

    it("throws when targeting a remote environment without credentials", () => {
      expect(() =>
        getConfiguredTestUserOrThrow(
          { PLAYWRIGHT_BASE_URL: "https://app.secpal.dev" },
          "https://app.secpal.dev"
        )
      ).toThrow("TEST_USER_EMAIL and TEST_USER_PASSWORD must be set");
    });
  });

  describe("describeAuthResolutionState", () => {
    it("returns authenticated when the user menu is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/",
          hasUserMenu: true,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("authenticated");
    });

    it("returns login when the app resolved to the login route", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/login",
          hasUserMenu: false,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("login");
    });

    it("returns recovery when the protected-route bootstrap recovery screen is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/customers",
          hasUserMenu: false,
          hasBootstrapRecoveryScreen: true,
        })
      ).toBe("recovery");
    });

    it("returns unresolved while neither login nor authenticated shell is visible", () => {
      expect(
        describeAuthResolutionState({
          pathname: "/",
          hasUserMenu: false,
          hasBootstrapRecoveryScreen: false,
        })
      ).toBe("unresolved");
    });
  });
});
