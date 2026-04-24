// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect, loginViaUI } from "./auth.setup";
import {
  isRemoteE2ETarget,
  waitForAuthResolution,
  waitForLoginFormReady,
} from "./auth-helpers";
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
      test.skip(
        isRemoteE2ETarget(),
        "Live targets use a dedicated no-secret smoke assertion for the current login gate state."
      );

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

    test("should honor a server-authoritative login lockout after a 429 response", async ({
      page,
      context,
    }) => {
      test.skip(
        isRemoteE2ETarget(),
        "Deterministic server-lockout coverage uses local mocked auth routes only."
      );

      await context.unroute("**/v1/auth/login");
      await context.route("**/v1/auth/login", async (route) => {
        const requestBody = route.request().postDataJSON() as
          | { email?: string }
          | undefined;

        if (requestBody?.email === "lockout-user@secpal.dev") {
          await route.fulfill({
            status: 429,
            contentType: "application/json",
            headers: {
              "Retry-After": "120",
            },
            body: JSON.stringify({
              message: "Too many login attempts. Please try again later.",
            }),
          });

          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: {
              id: "42",
              name: "Jane Example",
              email: "test@example.com",
              emailVerified: true,
              roles: ["Manager"],
              permissions: [],
              hasOrganizationalScopes: true,
              hasCustomerAccess: true,
              hasSiteAccess: true,
            },
          }),
        });
      });

      await page.goto("/login");
      await page.waitForLoadState("networkidle");
      await waitForLoginFormReady(page);

      await page.locator("#email").fill("lockout-user@secpal.dev");
      await page.locator("#password").fill("wrongpassword");
      await page
        .getByRole("button", { name: /log in|anmelden|einloggen/i })
        .click();

      await expect(page.locator("#lockout-warning")).toBeVisible();
      await expect(
        page.getByText(/too many login attempts\. please try again later\./i)
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /locked \(120s\)|locked \(119s\)/i })
      ).toBeDisabled();
      await expect(page.locator("#email")).toBeDisabled();
      await expect(page.locator("#password")).toBeDisabled();
    });

    test("should surface the current login readiness state on live targets", async ({
      page,
    }) => {
      test.skip(
        !isRemoteE2ETarget(),
        "Only relevant for the live no-secret auth smoke on app.secpal.dev."
      );

      await page.goto("/login");
      await page.waitForLoadState("networkidle");

      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();

      try {
        await waitForLoginFormReady(page);
      } catch (error) {
        const blockingReason = error instanceof Error ? error.message : "";

        if (!blockingReason.includes("health gate")) {
          throw error;
        }

        await expect(page.locator("#health-warning")).toBeVisible();
        return;
      }

      await expect(
        page.getByRole("button", { name: /log in|anmelden|einloggen/i })
      ).toBeEnabled();
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
      test.skip(
        isRemoteE2ETarget(),
        "Live targets can legitimately resolve protected browser-session routes through recovery instead of an immediate login redirect."
      );

      // Try to access protected route directly
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should resolve protected route auth bootstrap on live targets", async ({
      page,
    }) => {
      test.skip(
        !isRemoteE2ETarget(),
        "Only relevant for the live no-secret auth smoke on app.secpal.dev."
      );

      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      const authResolution = await waitForAuthResolution(page);

      expect(["login", "recovery"]).toContain(authResolution);

      if (authResolution === "login") {
        await expect(page).toHaveURL(/\/login/);
        return;
      }

      const bootstrapRecovery = page.locator(
        '[data-route-guard-state="bootstrap-recovery"]'
      );

      await expect(bootstrapRecovery).toBeVisible();
      await expect(bootstrapRecovery.locator("button").first()).toBeVisible();
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
