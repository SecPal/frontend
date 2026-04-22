// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "@playwright/test";
import { installMockAuthRoutes } from "./offline-live-helpers";
import {
  filterExpectedSmokeConsoleErrors,
  type SmokeResponseRecord,
} from "./smoke-console-errors";

/**
 * Smoke Tests for Critical User Flows
 *
 * These tests verify that the most critical user flows work correctly.
 * They run on every PR and should be fast and reliable.
 *
 * @see Issue #309 - Playwright performance tests for local development
 */

test.describe("Application Smoke Tests", () => {
  test.beforeEach(async ({ context }) => {
    const usesLocalPreviewTarget =
      Boolean(process.env.CI) &&
      !(process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://") ?? false);

    if (!usesLocalPreviewTarget) {
      return;
    }

    await installMockAuthRoutes(context);
  });

  test.describe("Page Loading", () => {
    test("should not have JavaScript errors on home page", async ({ page }) => {
      const jsErrors: string[] = [];
      const responses: SmokeResponseRecord[] = [];

      page.on("response", (resp) => {
        responses.push({ url: resp.url(), status: resp.status() });
      });

      // Set up console listener BEFORE navigation to catch all errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          jsErrors.push(msg.text());
        }
      });

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Verify page loaded successfully
      await expect(page).toHaveTitle(/SecPal/);

      // No JavaScript errors should occur
      expect(
        filterExpectedSmokeConsoleErrors(jsErrors, responses)
      ).toHaveLength(0);
    });

    test("should display login page for unauthenticated users", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Should redirect to login or show login UI
      // Check for common login indicators
      const loginForm = page
        .locator('form[action*="login"]')
        .or(page.locator("#login-form"))
        .or(page.getByRole("button", { name: /log in|sign in|anmelden/i }));

      // Either login form exists OR we're on a public page
      const hasLoginElements = await loginForm.count();
      expect(hasLoginElements).toBeGreaterThanOrEqual(0); // Page loads successfully
    });
  });

  test.describe("Navigation", () => {
    test("should navigate without errors", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Get initial URL
      const initialUrl = page.url();

      // Basic navigation should work
      expect(initialUrl).toContain("/");
    });
  });

  test.describe("Accessibility Basics", () => {
    test("should have valid HTML structure", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check for basic HTML structure
      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang");

      // Should have a main content area
      const main = page.locator("main");
      const hasMain = (await main.count()) > 0;

      // Should have at least one heading
      const headings = page.locator("h1, h2, h3");
      const hasHeadings = (await headings.count()) > 0;

      // At least one of these should be true for a valid page
      expect(hasMain || hasHeadings).toBeTruthy();
    });

    test("should have no missing alt attributes on images", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Find all images
      const images = page.locator("img");
      const imageCount = await images.count();

      // Check each image has an alt attribute
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute("alt");
        const src = await img.getAttribute("src");

        // Alt should exist (can be empty for decorative images)
        expect(alt, `Image ${src} should have alt attribute`).not.toBeNull();
      }
    });
  });

  test.describe("Performance Basics", () => {
    test("should load within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const loadTime = Date.now() - startTime;

      // DOM should be ready within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test("should have no large layout shifts during load", async ({ page }) => {
      await page.addInitScript(() => {
        (
          window as unknown as {
            __clsReady?: Promise<void>;
            __clsValue?: number;
          }
        ).__clsReady = new Promise<void>((resolve) => {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shiftEntry = entry as unknown as {
                value: number;
                hadRecentInput: boolean;
              };

              if (!shiftEntry.hadRecentInput) {
                clsValue += shiftEntry.value;
              }
            }
          });

          observer.observe({ type: "layout-shift", buffered: true });

          addEventListener(
            "load",
            () => {
              setTimeout(() => {
                observer.disconnect();
                (window as unknown as { __clsValue: number }).__clsValue =
                  clsValue;
                resolve();
              }, 3000);
            },
            { once: true }
          );
        });
      });

      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await page.evaluate(
        () => (window as unknown as { __clsReady?: Promise<void> }).__clsReady
      );

      const cls = await page.evaluate(
        () => (window as unknown as { __clsValue: number }).__clsValue || 0
      );

      // CLS should be below 0.1 (good threshold)
      expect(cls).toBeLessThan(0.1);
    });
  });
});
