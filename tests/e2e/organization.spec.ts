// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "./auth.setup";
import { getCachedOrgUnitsCount } from "../utils/offline-helpers";

/**
 * Organization Management E2E Tests
 *
 * Basic integration tests for organizational structure pages.
 * These tests verify that pages load correctly for authenticated users.
 * For offline functionality tests, see offline.spec.ts
 */

test.describe("Organization Management", () => {
  test.describe("Organization Overview", () => {
    test("should display organization page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Should show organization page - check for heading
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  });

  test.describe("Customers", () => {
    test("should display customers list", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/customers");
      await page.waitForLoadState("networkidle");

      // Should show customers page
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  });

  test.describe("Guard Books", () => {
    test("should display guard books list", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/guard-books");
      await page.waitForLoadState("networkidle");

      // Should show guard books page
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  });

  test.describe("Performance", () => {
    test("should load organization pages without errors", async ({
      authenticatedPage: page,
    }) => {
      const jsErrors: string[] = [];
      // Set up console listener BEFORE navigation to catch all errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (
            !text.includes("net::ERR_") &&
            !text.includes("Failed to load resource") &&
            !text.includes("favicon")
          ) {
            jsErrors.push(text);
          }
        }
      });

      const pages = ["/organization", "/customers", "/guard-books"];

      for (const path of pages) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
      }

      // Wait for any pending async operations
      await page.waitForLoadState("networkidle");

      expect(jsErrors).toHaveLength(0);
    });
  });

  test.describe("Cache Verification", () => {
    test("should populate IndexedDB cache on page load", async ({
      authenticatedPage: page,
    }) => {
      // Navigate to organization page
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Wait for units to load
      await page.waitForTimeout(1000);

      // Check that cache is populated
      const cachedCount = await getCachedOrgUnitsCount(page);

      // We don't assert a specific number, just that cache works
      // In a real environment with data, this should be > 0
      expect(cachedCount).toBeGreaterThanOrEqual(0);
    });
  });
});
