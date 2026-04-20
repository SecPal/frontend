// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, type Page } from "@playwright/test";

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

const LOGIN_READY_TIMEOUT_MS = 15_000;
const AUTH_RESOLUTION_TIMEOUT_MS = 15_000;
const BOOTSTRAP_RECOVERY_SELECTOR =
  '[data-route-guard-state="bootstrap-recovery"]';

export function isRemoteE2ETarget(baseUrl = process.env.PLAYWRIGHT_BASE_URL) {
  return typeof baseUrl === "string" && /^https:\/\//i.test(baseUrl);
}

export function buildTestUser(
  env: NodeJS.ProcessEnv = process.env,
  baseUrl = env.PLAYWRIGHT_BASE_URL
): TestUserCredentials {
  const email = env.TEST_USER_EMAIL?.trim() ?? "";
  const password = env.TEST_USER_PASSWORD?.trim() ?? "";

  if (isRemoteE2ETarget(baseUrl)) {
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
  baseUrl = env.PLAYWRIGHT_BASE_URL
): TestUserCredentials {
  const testUser = buildTestUser(env, baseUrl);

  if (testUser.email && testUser.password) {
    return testUser;
  }

  throw new Error(
    "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set when Playwright targets a remote environment such as app.secpal.dev."
  );
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
  if (state.hasUserMenu) {
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
    (bootstrapRecoverySelector) => ({
      pathname: window.location.pathname,
      hasUserMenu:
        document.querySelector('button[aria-label="User menu"]') !== null,
      hasBootstrapRecoveryScreen:
        document.querySelector(bootstrapRecoverySelector) !== null,
    }),
    BOOTSTRAP_RECOVERY_SELECTOR
  );
}

export async function waitForAuthResolution(
  page: Page,
  timeout = AUTH_RESOLUTION_TIMEOUT_MS
): Promise<AuthResolution> {
  await page
    .waitForFunction(
      (bootstrapRecoverySelector) =>
        window.location.pathname.includes("/login") ||
        document.querySelector('button[aria-label="User menu"]') !== null ||
        document.querySelector(bootstrapRecoverySelector) !== null,
      BOOTSTRAP_RECOVERY_SELECTOR,
      { timeout }
    )
    .catch(() => undefined);

  const state = await readAuthResolutionState(page);

  return describeAuthResolutionState(state);
}
