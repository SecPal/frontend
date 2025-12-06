// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "./auth.setup";

/**
 * Secrets Management E2E Tests
 *
 * Basic integration tests for the secrets page.
 * These tests verify that the page loads correctly and basic navigation works.
 */

test.describe("Secrets Management", () => {
  test.describe("Secret List", () => {
    test("should display secrets list after login", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/secrets");
      await page.waitForLoadState("networkidle");

      // Should show main secrets page heading (h1)
      await expect(
        page.getByRole("heading", { level: 1, name: /secrets|geheimnisse/i })
      ).toBeVisible();

      // Should have at least one link to create a new secret
      const createLink = page.locator('a[href="/secrets/new"]').first();
      await expect(createLink).toBeVisible();
    });

    test("should navigate to create secret page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/secrets");
      await page.waitForLoadState("networkidle");

      // Click the first create secret link
      await page.locator('a[href="/secrets/new"]').first().click();

      // Should navigate to create page
      await expect(page).toHaveURL(/\/secrets\/new/);

      // Should show create form with title field
      await expect(page.locator("#title")).toBeVisible();
    });
  });

  test.describe("Secret CRUD Operations", () => {
    test("should create a new secret", async ({ authenticatedPage: page }) => {
      const testSecretTitle = `E2E Test ${Date.now()}`;

      await page.goto("/secrets/new");
      await page.waitForLoadState("networkidle");

      // Fill in secret form - use specific ID selector
      await page.locator("#title").fill(testSecretTitle);

      // Find and fill the description field if it exists
      const descriptionField = page.locator("#description");
      if ((await descriptionField.count()) > 0) {
        await descriptionField.fill("Created by E2E test");
      }

      // Submit the form - look for create button
      await page.getByRole("button", { name: /create|erstellen/i }).click();

      // Should redirect away from /new
      await page.waitForURL((url) => !url.pathname.includes("/new"), {
        timeout: 10_000,
      });
    });
  });

  test.describe("Performance", () => {
    test("should load secrets list quickly", async ({
      authenticatedPage: page,
    }) => {
      const startTime = Date.now();

      await page.goto("/secrets");
      await page.waitForLoadState("domcontentloaded");

      const loadTime = Date.now() - startTime;

      // Secrets list should load within 5 seconds (generous for CI)
      expect(loadTime).toBeLessThan(5000);
    });

    test("should not have JavaScript errors on secrets page", async ({
      authenticatedPage: page,
    }) => {
      const jsErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Ignore network errors and common browser warnings
          if (
            !text.includes("net::ERR_") &&
            !text.includes("Failed to load resource") &&
            !text.includes("favicon")
          ) {
            jsErrors.push(text);
          }
        }
      });

      await page.goto("/secrets");
      await page.waitForLoadState("networkidle");

      // Wait a bit for any async errors
      await page.waitForTimeout(500);

      expect(jsErrors).toHaveLength(0);
    });
  });
});
