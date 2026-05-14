// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, type Page } from "@playwright/test";
import {
  isLiveRemoteTarget,
  isRemotePlaywrightTarget,
  resolvePlaywrightBaseUrl,
} from "./target-urls";

export interface TestUserCredentials {
  email: string;
  password: string;
}

export interface LoginSubmitState {
  disabled: boolean;
  ariaDisabled: string | null;
  text: string | null;
  healthWarning: string | null;
  offlineWarning: string | null;
  lockoutWarning: string | null;
  error: string | null;
}

export interface AuthResolutionState {
  pathname: string;
  hasUserMenu: boolean;
  /** Pre-contract users use `OnboardingLayout` (Sign out) instead of the main nav user menu. */
  hasOnboardingShell: boolean;
  hasBootstrapRecoveryScreen: boolean;
}

export type AuthResolution =
  | "authenticated"
  | "login"
  | "recovery"
  | "unresolved";

const DEFAULT_LOCAL_TEST_USER: TestUserCredentials = {
  email: "test@example.com",
  password: "password",
};

/** Seeded pre-contract onboarding user — see `contrib/secpal-api/README.md`. */
const DEFAULT_LIVE_ONBOARDING_USER: TestUserCredentials = {
  email: "onboarding@example.com",
  password: "password",
};

const LOGIN_READY_TIMEOUT_MS = 15_000;
const AUTH_RESOLUTION_TIMEOUT_MS = 15_000;
const BOOTSTRAP_RECOVERY_SELECTOR =
  '[data-route-guard-state="bootstrap-recovery"]';

function isLocalPlaywrightHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("127.") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "ddev.site" ||
    hostname.endsWith(".ddev.site")
  );
}

export function isRemoteE2ETarget(baseUrl?: string): boolean {
  const resolved = baseUrl ?? resolvePlaywrightBaseUrl();
  if (!isRemotePlaywrightTarget(resolved)) {
    return false;
  }
  try {
    return !isLocalPlaywrightHost(new URL(resolved).hostname);
  } catch {
    return true;
  }
}

export function buildTestUser(
  env: NodeJS.ProcessEnv = process.env,
  baseUrl?: string
): TestUserCredentials {
  const email = env.TEST_USER_EMAIL?.trim() ?? "";
  const password = env.TEST_USER_PASSWORD?.trim() ?? "";
  const resolvedBase = baseUrl ?? resolvePlaywrightBaseUrl(env);

  if (isLiveRemoteTarget(resolvedBase)) {
    const liveOnboarding = env.PLAYWRIGHT_LIVE_ONBOARDING === "1";
    if (liveOnboarding) {
      return {
        email: email || DEFAULT_LIVE_ONBOARDING_USER.email,
        password: password || DEFAULT_LIVE_ONBOARDING_USER.password,
      };
    }
    return {
      email,
      password,
    };
  }

  return {
    email: email || DEFAULT_LOCAL_TEST_USER.email,
    password: password || DEFAULT_LOCAL_TEST_USER.password,
  };
}

export function getConfiguredTestUserOrThrow(
  env: NodeJS.ProcessEnv = process.env,
  baseUrl?: string
): TestUserCredentials {
  const resolvedBase = baseUrl ?? resolvePlaywrightBaseUrl(env);
  const testUser = buildTestUser(env, resolvedBase);

  if (testUser.email && testUser.password) {
    return testUser;
  }

  throw new Error(
    "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set when Playwright targets a non-workspace remote environment. " +
      "Exception: set PLAYWRIGHT_LIVE_ONBOARDING=1 to use the standard seeded onboarding user (onboarding@example.com) when TEST_USER_* is unset."
  );
}

function normalizeAuthCacheKeyPart(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "default";
}

export function getAuthStateCachePath(
  user: TestUserCredentials,
  baseUrl?: string
): string {
  const resolved = baseUrl ?? resolvePlaywrightBaseUrl();
  let targetScope = "local";

  if (isRemoteE2ETarget(resolved)) {
    try {
      targetScope = new URL(resolved).host;
    } catch {
      targetScope = "remote";
    }
  }

  const scopePart = normalizeAuthCacheKeyPart(targetScope);
  const userPart = normalizeAuthCacheKeyPart(user.email);

  return `./tests/e2e/.auth/${scopePart}-${userPart}.json`;
}

export function describeLoginBlockingState(
  state: LoginSubmitState
): string | null {
  if (!state.disabled) {
    return null;
  }

  if (state.healthWarning) {
    return `Login blocked by health gate: ${state.healthWarning}`;
  }

  if (state.offlineWarning) {
    return `Login blocked by offline gate: ${state.offlineWarning}`;
  }

  if (state.lockoutWarning) {
    return `Login blocked by rate-limit lockout: ${state.lockoutWarning}`;
  }

  if (state.error) {
    return `Login blocked with visible error: ${state.error}`;
  }

  if (state.text) {
    return `Login submit is still disabled (${state.text}).`;
  }

  return "Login submit is still disabled.";
}

export function describeAuthResolutionState(
  state: AuthResolutionState
): AuthResolution {
  if (state.hasUserMenu || state.hasOnboardingShell) {
    return "authenticated";
  }

  if (state.pathname.includes("/login")) {
    return "login";
  }

  if (state.hasBootstrapRecoveryScreen) {
    return "recovery";
  }

  return "unresolved";
}

export async function readLoginSubmitState(
  page: Page
): Promise<LoginSubmitState> {
  return page.evaluate(() => {
    const submitButton = document.querySelector("button[type='submit']");

    return {
      disabled: submitButton?.hasAttribute("disabled") ?? false,
      ariaDisabled: submitButton?.getAttribute("aria-disabled") ?? null,
      text: submitButton?.textContent?.trim() ?? null,
      healthWarning:
        document.querySelector("#health-warning")?.textContent?.trim() ?? null,
      offlineWarning:
        document.querySelector("#offline-warning")?.textContent?.trim() ?? null,
      lockoutWarning:
        document.querySelector("#lockout-warning")?.textContent?.trim() ?? null,
      error:
        document.querySelector("#login-error")?.textContent?.trim() ?? null,
    };
  });
}

export async function waitForLoginFormReady(
  page: Page,
  timeout = LOGIN_READY_TIMEOUT_MS
): Promise<void> {
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();

  await page.waitForFunction(
    () => {
      const submitButton = document.querySelector("button[type='submit']");

      return Boolean(
        (submitButton && !submitButton.hasAttribute("disabled")) ||
          document.querySelector("#health-warning") ||
          document.querySelector("#offline-warning") ||
          document.querySelector("#lockout-warning") ||
          document.querySelector("#login-error")
      );
    },
    { timeout }
  );

  const state = await readLoginSubmitState(page);
  const reason = describeLoginBlockingState(state);

  if (reason) {
    throw new Error(reason);
  }
}

export async function readAuthResolutionState(
  page: Page
): Promise<AuthResolutionState> {
  return page.evaluate(
    (bootstrapRecoverySelector) => {
      const pathname = window.location.pathname;
      const hasOnboardingShell =
        /^\/onboarding(\/|$)/.test(pathname) &&
        Array.from(document.querySelectorAll("button")).some((btn) =>
          /sign out|abmelden|ausloggen/i.test((btn.textContent ?? "").trim())
        );

      return {
        pathname,
        hasUserMenu:
          document.querySelector('button[aria-label="User menu"]') !== null,
        hasOnboardingShell,
        hasBootstrapRecoveryScreen:
          document.querySelector(bootstrapRecoverySelector) !== null,
      };
    },
    BOOTSTRAP_RECOVERY_SELECTOR
  );
}

export async function waitForAuthResolution(
  page: Page,
  timeout = AUTH_RESOLUTION_TIMEOUT_MS
): Promise<AuthResolution> {
  await page
    .waitForFunction(
      (bootstrapRecoverySelector) => {
        const path = window.location.pathname;
        const onboardingShell =
          /^\/onboarding(\/|$)/.test(path) &&
          Array.from(document.querySelectorAll("button")).some((btn) =>
            /sign out|abmelden|ausloggen/i.test((btn.textContent ?? "").trim())
          );

        return (
          path.includes("/login") ||
          document.querySelector('button[aria-label="User menu"]') !== null ||
          document.querySelector(bootstrapRecoverySelector) !== null ||
          onboardingShell
        );
      },
      BOOTSTRAP_RECOVERY_SELECTOR,
      { timeout }
    )
    .catch(() => undefined);

  const state = await readAuthResolutionState(page);

  return describeAuthResolutionState(state);
}
