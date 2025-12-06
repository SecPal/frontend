// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect, loginViaUI, TEST_USER } from "./auth.setup";

/**
 * Authentication Flow Tests
 *
 * Tests for login, logout, and session management.
 */

test.describe("Authentication", () => {
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
    await page.locator("#email").fill(TEST_USER.email);
    await page.locator("#password").fill("wrongpassword");
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
    // This test doesn't use authenticatedPage to avoid fixture issues
    // Instead, we login manually here
    await page.goto("/login");
    await page.locator("#email").fill(TEST_USER.email);
    await page.locator("#password").fill(TEST_USER.password);
    await page
      .getByRole("button", { name: /log in|anmelden|einloggen/i })
      .click();

    // Wait for redirect after login
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15_000,
    });

    // Now we should be on the dashboard - find the user dropdown button
    // It contains the user's name and email
    const dropdownTrigger = page.getByRole("button", {
      name: new RegExp(TEST_USER.email, "i"),
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

  test("should persist session across page reload", async ({
    authenticatedPage: page,
  }) => {
    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Should still be logged in (not redirected to login)
    expect(page.url()).not.toContain("/login");
  });

  test("should redirect to login when accessing protected route without auth", async ({
    page,
  }) => {
    // Try to access protected route directly
    await page.goto("/secrets");
    await page.waitForLoadState("networkidle");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });
});
