// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect, loginViaUI } from "./auth.setup";
import { isRemoteE2ETarget, waitForLoginFormReady } from "./auth-helpers";
import { installMockAuthRoutes } from "./offline-live-helpers";

/**
 * Authentication Flow Tests
 *
 * Tests for login, logout, and session management.
 */

test.describe("Authentication", () => {
  // Unauthenticated paths — use the default `page` + `context` fixtures so
  // mock routes are installed on exactly the context each test uses.
  test.describe("unauthenticated paths", () => {
    test.beforeEach(async ({ context }) => {
      if (!isRemoteE2ETarget()) {
        await installMockAuthRoutes(context);
      }
    });

    test("should login with valid credentials", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      // Verify login page is shown (using ID selectors matching Login.tsx)
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();

      // Perform login
      await loginViaUI(page);

      // Should be redirected to home/dashboard
      expect(page.url()).not.toContain("/login");

      // Should see authenticated UI elements (e.g., navigation, user menu)
      await expect(
        page.getByRole("navigation").or(page.locator('[data-slot="sidebar"]'))
      ).toBeVisible();
    });

    test("should reject invalid credentials", async ({ page }) => {
      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      // Try to login with wrong password
      await page.locator("#email").fill("wrong-user@secpal.dev");
      await page.locator("#password").fill("wrongpassword");
      await waitForLoginFormReady(page);
      await page
        .getByRole("button", { name: /log in|anmelden|einloggen/i })
        .click();

      // Should stay on login page
      await expect(page).toHaveURL(/\/login/);

      // Should show error message
      await expect(
        page.getByText(/invalid|incorrect|falsch|ungültig|credentials/i)
      ).toBeVisible({ timeout: 10_000 });
    });

    test("should logout successfully", async ({ page }) => {
      // Use a fresh UI login so this destructive flow does not invalidate the
      // shared authenticated fixture state used by parallel auth tests.
      await loginViaUI(page);

      // Now we should be on the dashboard - open the user menu
      const dropdownTrigger = page.getByRole("button", {
        name: /user menu/i,
      });

      // Click to open user menu dropdown
      await dropdownTrigger.click();

      // Wait for dropdown menu to appear and click "Sign out"
      await page
        .getByRole("menuitem", { name: /sign out|abmelden/i })
        .click({ timeout: 5_000 });

      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });

    test("should redirect to login when accessing protected route without auth", async ({
      page,
    }) => {
      // Try to access protected route directly
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  // Session persistence — `authenticatedPage` installs its own mock routes;
  // no beforeEach needed here to avoid creating an extra unused context.
  test.describe("session persistence", () => {
    test("should persist session across page reload", async ({
      authenticatedPage: page,
    }) => {
      // Reload page
      await page.reload();
      await page.waitForLoadState("networkidle");

      // Should still be logged in (not redirected to login)
      expect(page.url()).not.toContain("/login");
    });

    test("should stay authenticated when deep-linking to a protected route and reloading it", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/customers");
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/customers$/);
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible({
        timeout: 15_000,
      });

      await page.reload();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(/\/customers$/);
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
