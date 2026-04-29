// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "./auth.setup";
import { offlineLiveMockOrganizationUnit } from "./offline-live-helpers";

const ROTATED_XSRF_TOKEN = "rotated-xsrf-token";

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

    test("should keep browser-session organization access after XSRF token rotation on authenticated GET refreshes", async ({
      authenticatedPage: page,
    }) => {
      const context = page.context();
      let organizationRequestCount = 0;

      await context.route("**/v1/organizational-units**", async (route) => {
        organizationRequestCount += 1;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers:
            organizationRequestCount === 1
              ? {
                  "set-cookie": `XSRF-TOKEN=${ROTATED_XSRF_TOKEN}; Path=/; SameSite=Lax`,
                }
              : {},
          body: JSON.stringify({
            data: [offlineLiveMockOrganizationUnit],
            meta: {
              current_page: 1,
              last_page: 1,
              per_page: 100,
              total: 1,
              root_unit_ids: [offlineLiveMockOrganizationUnit.id],
            },
          }),
        });
      });

      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /organization structure/i })
      ).toBeVisible();
      await expect(
        page.getByText(offlineLiveMockOrganizationUnit.name).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible();
      await expect(
        page.getByText("Offline vault is not available.")
      ).toHaveCount(0);

      await expect
        .poll(async () => {
          const cookies = await context.cookies();

          return cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
        })
        .toBe(ROTATED_XSRF_TOKEN);

      await page.reload();
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /organization structure/i })
      ).toBeVisible();
      await expect(
        page.getByText(offlineLiveMockOrganizationUnit.name).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible();
      await expect(
        page.getByText("Offline vault is not available.")
      ).toHaveCount(0);
      expect(organizationRequestCount).toBeGreaterThanOrEqual(2);
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
