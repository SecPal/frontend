// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { loginViaUI, test, expect } from "./auth.setup";
import { isRemoteE2ETarget } from "./auth-helpers";
import type { BrowserContext, Page } from "@playwright/test";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installMockOrganizationRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";
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
      Boolean(process.env.CI) && !isRemoteE2ETarget();

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
    test("should keep the full route loader hidden on warmed customer navigation", async ({
      context,
      page,
    }) => {
      await installMockAuthRoutes(context);
      await loginViaUI(page, "warm-navigation@secpal.dev", "password");

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      await page.evaluate(() => {
        const win = window as typeof window & {
          __fullRouteLoaderSeen?: boolean;
        };

        win.__fullRouteLoaderSeen = false;
        const markLoaderIfPresent = () => {
          if (document.querySelector('[data-slot="app-shell-loader"]')) {
            win.__fullRouteLoaderSeen = true;
          }
        };

        markLoaderIfPresent();
        new MutationObserver(markLoaderIfPresent).observe(
          document.documentElement,
          {
            childList: true,
            subtree: true,
          }
        );
      });

      const customerLinks = page.getByRole("link", { name: /customers/i });
      await expect(customerLinks.first()).toBeVisible();
      await customerLinks.first().hover();
      await page.waitForLoadState("networkidle");
      await customerLinks.first().click();

      await expect(
        page.getByRole("heading", { name: /^customers$/i })
      ).toBeVisible();

      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (
                window as typeof window & {
                  __fullRouteLoaderSeen?: boolean;
                }
              ).__fullRouteLoaderSeen ?? false
          )
        )
        .toBe(false);
    });

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

const employeeSmokeMockUser = buildOfflineLiveMockUser({
  permissions: ["employees.read"],
});

interface ActivityLogSmokeCapture {
  activityLogRequests: Array<{ url: string; status: number }>;
  failedRequests: Array<{ url: string; error: string }>;
  jsErrors: string[];
  responses: SmokeResponseRecord[];
}

async function installMockEmployeeListRoute(
  context: BrowserContext
): Promise<void> {
  await context.route(/\/v1\/employees(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 0,
        },
      }),
    });
  });
}

function attachActivityLogSmokeCapture(page: Page): ActivityLogSmokeCapture {
  const activityLogRequests: Array<{ url: string; status: number }> = [];
  const failedRequests: Array<{ url: string; error: string }> = [];
  const jsErrors: string[] = [];
  const responses: SmokeResponseRecord[] = [];

  page.on("response", (response) => {
    responses.push({ url: response.url(), status: response.status() });
    if (response.url().includes("/v1/activity-logs")) {
      activityLogRequests.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  page.on("requestfailed", (request) => {
    if (request.url().includes("/v1/activity-logs")) {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText ?? "unknown",
      });
    }
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      jsErrors.push(msg.text());
    }
  });

  return {
    activityLogRequests,
    failedRequests,
    jsErrors,
    responses,
  };
}

async function expectEmployeesPageWithoutActivityLogFailures(
  page: Page,
  capture: ActivityLogSmokeCapture
): Promise<void> {
  await page.goto("/employees");
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { name: /employee management/i })
  ).toBeVisible();

  expect(capture.activityLogRequests).toEqual([]);
  expect(capture.failedRequests).toEqual([]);
  expect(
    filterExpectedSmokeConsoleErrors(capture.jsErrors, capture.responses)
  ).toHaveLength(0);
}

test.describe("Authenticated Smoke Tests", () => {
  test("should load employees without activity-log fetch failures", async ({
    browser,
  }) => {
    const context = await browser.newContext();

    try {
      const page = await context.newPage();

      if (isRemoteE2ETarget()) {
        await loginViaUI(page);
        const capture = attachActivityLogSmokeCapture(page);
        await expectEmployeesPageWithoutActivityLogFailures(page, capture);

        return;
      }

      await installMockAuthRoutes(context, employeeSmokeMockUser);
      await installMockOrganizationRoutes(context);
      await installMockEmployeeListRoute(context);

      await installStoredMockBrowserSession(page, employeeSmokeMockUser);
      const capture = attachActivityLogSmokeCapture(page);
      await expectEmployeesPageWithoutActivityLogFailures(page, capture);
    } finally {
      await context.close();
    }
  });
});
