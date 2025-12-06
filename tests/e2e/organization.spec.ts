// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "./auth.setup";

/**
 * Organization Management E2E Tests
 *
 * Basic integration tests for organizational structure pages.
 * These tests verify that pages load correctly for authenticated users.
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
        await page.waitForLoadState("domcontentloaded");
      }

      // Wait a bit for any async errors
      await page.waitForTimeout(500);

      expect(jsErrors).toHaveLength(0);
    });
  });
});
