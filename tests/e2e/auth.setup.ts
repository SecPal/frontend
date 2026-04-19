// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test as base, expect, type Page } from "@playwright/test";
import {
  buildTestUser,
  getConfiguredTestUserOrThrow,
  waitForAuthResolution,
  waitForLoginFormReady,
} from "./auth-helpers";

/**
 * Test Credentials
 *
 * These are the standard test credentials for local development.
 * In CI, these can be overridden via environment variables.
 */
export const TEST_USER = {
  ...buildTestUser(),
};

/**
 * Login helper function
 *
 * Performs a full login through the UI.
 * Use this for tests that need to verify login flow.
 */
export async function loginViaUI(
  page: Page,
  email?: string,
  password?: string
): Promise<void> {
  const configuredTestUser =
    email && password ? { email, password } : getConfiguredTestUserOrThrow();

  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Fill in credentials using ID selectors (matching Login.tsx)
  await page.locator("#email").fill(configuredTestUser.email);
  await page.locator("#password").fill(configuredTestUser.password);

  await waitForLoginFormReady(page);

  // Submit form - "Log in" in English, "Anmelden" or similar in German
  await page
    .getByRole("button", { name: /log in|anmelden|einloggen/i })
    .click();

  // Wait for navigation to complete (should redirect to home after login)
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15_000,
  });
}

/**
 * Path to saved auth state (created by global-setup.ts)
 */
const AUTH_FILE = "./tests/e2e/.auth/user.json";

/**
 * Extended test fixture with authentication support
 *
 * Uses saved session state from global-setup.ts to avoid rate-limiting.
 * Falls back to UI login if session file doesn't exist.
 */
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ browser }, runTest) => {
    const configuredTestUser = getConfiguredTestUserOrThrow();

    // Try to use saved auth state
    let context;
    try {
      context = await browser.newContext({ storageState: AUTH_FILE });
    } catch {
      // Fall back to fresh context if auth file doesn't exist
      context = await browser.newContext();
    }

    const page = await context.newPage();

    // Resolve whether the reused storage state still results in the authenticated shell.
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const authResolution = await waitForAuthResolution(page);

    if (authResolution !== "authenticated") {
      await loginViaUI(
        page,
        configuredTestUser.email,
        configuredTestUser.password
      );
    }

    // Verify we're logged in with the actual authenticated application shell.
    await expect(page.getByRole("button", { name: /user menu/i })).toBeVisible({
      timeout: 15_000,
    });
    expect(page.url()).not.toContain("/login");

    // Run the test with authenticated page
    await runTest(page);

    // Cleanup
    await context.close();
  },
});

export { expect };
