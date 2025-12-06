// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";

/**
 * Performance Tests with Lighthouse Integration
 *
 * These tests run Lighthouse audits against the application to measure
 * Core Web Vitals and other performance metrics.
 *
 * Note: These tests require Chromium with remote debugging enabled.
 * The playwright.config.ts already configures this.
 *
 * IMPORTANT: These tests are designed for staging/production environments.
 * Dev server performance will be significantly lower due to:
 * - No code minification
 * - No tree-shaking
 * - Source maps enabled
 * - HMR overhead
 *
 * Run with: npm run test:e2e:staging (uses https://app.secpal.dev)
 *
 * @see Issue #309 - Playwright performance tests for local development
 */

// Only run against staging/production (remote HTTPS targets)
const isRemoteTarget =
  process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://") ?? false;

// Performance thresholds based on Core Web Vitals
const PERFORMANCE_THRESHOLDS = {
  performance: 90,
  accessibility: 90,
  "best-practices": 90,
};

test.describe("Lighthouse Performance Audits", () => {
  // Skip unless running against staging/production
  test.skip(
    () => !isRemoteTarget,
    "Performance tests only run against staging (npm run test:e2e:staging)"
  );

  // Only run on chromium (Lighthouse requires Chrome DevTools Protocol)
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Lighthouse only works with Chromium"
  );

  test("should meet performance thresholds on home page", async ({
    page,
  }, testInfo) => {
    // Navigate to the page first
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Run Lighthouse audit
    const result = await playAudit({
      page,
      port: 9222,
      thresholds: PERFORMANCE_THRESHOLDS,
      reports: {
        formats: {
          html: true,
        },
        name: `lighthouse-${testInfo.title.replace(/\s+/g, "-")}`,
        directory: "test-results/lighthouse",
      },
    });

    // Verify audit passed
    expect(result.lhr.categories.performance.score).toBeGreaterThanOrEqual(
      PERFORMANCE_THRESHOLDS.performance / 100
    );
  });

  test("should have good Core Web Vitals", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const result = await playAudit({
      page,
      port: 9222,
      thresholds: PERFORMANCE_THRESHOLDS,
      reports: {
        formats: {
          html: true,
        },
        name: `lighthouse-cwv-${testInfo.title.replace(/\s+/g, "-")}`,
        directory: "test-results/lighthouse",
      },
    });

    // Extract Core Web Vitals from audit
    const lcp =
      result.lhr.audits["largest-contentful-paint"]?.numericValue || 0;
    const cls = result.lhr.audits["cumulative-layout-shift"]?.numericValue || 0;
    const tbt = result.lhr.audits["total-blocking-time"]?.numericValue || 0;

    console.log(`Core Web Vitals:
      - LCP: ${lcp}ms (target: <2500ms)
      - CLS: ${cls} (target: <0.1)
      - TBT: ${tbt}ms (target: <200ms)`);

    // Verify Core Web Vitals are within acceptable ranges
    expect(lcp, "LCP should be under 2.5s").toBeLessThan(2500);
    expect(cls, "CLS should be under 0.1").toBeLessThan(0.1);
    expect(tbt, "TBT should be under 200ms").toBeLessThan(200);
  });
});
