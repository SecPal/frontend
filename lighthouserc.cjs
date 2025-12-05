// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: CC0-1.0

/**
 * Lighthouse CI Configuration
 *
 * Performance budgets based on Core Web Vitals thresholds:
 * - LCP (Largest Contentful Paint): Good < 2.5s
 * - CLS (Cumulative Layout Shift): Good < 0.1
 * - INP/TBT (Interaction to Next Paint / Total Blocking Time): Good < 200ms
 *
 * @see https://web.dev/articles/vitals
 * @see https://github.com/GoogleChrome/lighthouse-ci
 */

/** @type {import('@lhci/cli').Config} */
module.exports = {
  ci: {
    collect: {
      // Use static server for built files
      staticDistDir: "./dist",

      // Number of runs per URL (median is used)
      numberOfRuns: 3,

      // URLs to test (relative to staticDistDir)
      url: ["/"],

      // Chrome flags for consistent results
      settings: {
        // Use desktop preset for consistent CI results
        preset: "desktop",

        // Throttling settings for realistic conditions
        throttling: {
          // Use simulated throttling for faster CI
          cpuSlowdownMultiplier: 1,
        },

        // Skip audits that require network (we're testing static build)
        skipAudits: ["is-on-https", "redirects-http", "uses-http2"],

        // Only run performance-related categories
        onlyCategories: ["performance", "accessibility", "best-practices"],
      },
    },

    assert: {
      // Assertions for performance budgets
      assertions: {
        // Core Web Vitals - Performance
        "categories:performance": ["warn", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 1800 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
        "speed-index": ["warn", { maxNumericValue: 3400 }],

        // Accessibility
        "categories:accessibility": ["warn", { minScore: 0.9 }],

        // Best Practices (includes JS error detection)
        "categories:best-practices": ["warn", { minScore: 0.9 }],

        // JavaScript errors (critical - fail on any JS error)
        "errors-in-console": ["error", { maxNumericValue: 0 }],

        // Resource optimization
        "uses-responsive-images": "warn",
        "offscreen-images": "warn",
        "unminified-javascript": "error",
        "unminified-css": "error",
        "unused-javascript": "warn",
        "unused-css-rules": "warn",

        // Caching
        "uses-long-cache-ttl": "warn",

        // Compression
        "uses-text-compression": "warn",
      },
    },

    upload: {
      // Use temporary public storage (no server required)
      target: "temporary-public-storage",
    },
  },
};
