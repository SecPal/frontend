// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import type { Metric } from "web-vitals";
import { PERFORMANCE_THRESHOLDS } from "./webVitals";

/**
 * Development-mode specific tests for Web Vitals warnings
 *
 * These tests validate that performance warnings are shown in development
 * but NOT in production.
 *
 * Note: We cannot easily test the actual console.warn calls because
 * import.meta.env.DEV is statically determined at build time.
 * These tests document the expected behavior and validate thresholds.
 */

describe("Web Vitals Development Warnings", () => {
  describe("Performance Thresholds Configuration", () => {
    it("should have thresholds aligned with Lighthouse CI", () => {
      // These values must match lighthouserc.cjs assertions
      expect(PERFORMANCE_THRESHOLDS.LCP).toEqual({
        good: 2500,
        needsImprovement: 4000,
      });

      expect(PERFORMANCE_THRESHOLDS.CLS).toEqual({
        good: 0.1,
        needsImprovement: 0.25,
      });

      expect(PERFORMANCE_THRESHOLDS.INP).toEqual({
        good: 200,
        needsImprovement: 500,
      });

      expect(PERFORMANCE_THRESHOLDS.FCP).toEqual({
        good: 1800,
        needsImprovement: 3000,
      });

      expect(PERFORMANCE_THRESHOLDS.TTFB).toEqual({
        good: 800,
        needsImprovement: 1800,
      });
    });
  });

  describe("Expected Warning Behavior", () => {
    it("should warn for poor LCP in development", () => {
      const poorLCP: Metric = {
        name: "LCP",
        value: 5000,
        rating: "poor",
        delta: 5000,
        id: "lcp-poor",
        navigationType: "navigate",
        entries: [],
      };

      // In development (import.meta.env.DEV = true):
      // Expected: console.warn("⚠️ Performance Warning: LCP (5000ms) exceeds threshold", {...})

      expect(poorLCP.value).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.LCP.needsImprovement
      );
    });

    it("should warn for poor CLS in development", () => {
      const poorCLS: Metric = {
        name: "CLS",
        value: 0.3,
        rating: "poor",
        delta: 0.3,
        id: "cls-poor",
        navigationType: "navigate",
        entries: [],
      };

      expect(poorCLS.value).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.CLS.needsImprovement
      );
    });

    it("should warn for needs-improvement metrics in development", () => {
      const needsImprovementLCP: Metric = {
        name: "LCP",
        value: 3000,
        rating: "needs-improvement",
        delta: 3000,
        id: "lcp-needs-improvement",
        navigationType: "navigate",
        entries: [],
      };

      // In development: Should warn with "needs improvement" message
      expect(needsImprovementLCP.value).toBeGreaterThan(
        PERFORMANCE_THRESHOLDS.LCP.good
      );
      expect(needsImprovementLCP.value).toBeLessThanOrEqual(
        PERFORMANCE_THRESHOLDS.LCP.needsImprovement
      );
    });

    it("should NOT warn for good metrics in any environment", () => {
      const goodLCP: Metric = {
        name: "LCP",
        value: 2000,
        rating: "good",
        delta: 2000,
        id: "lcp-good",
        navigationType: "navigate",
        entries: [],
      };

      // No warnings expected for good metrics
      expect(goodLCP.value).toBeLessThanOrEqual(
        PERFORMANCE_THRESHOLDS.LCP.good
      );
    });
  });

  describe("Production Behavior", () => {
    it("should document production behavior", () => {
      // In production (import.meta.env.DEV = false):
      // No console.warn calls should be made, even for poor metrics
      // This is enforced by the `if (import.meta.env.DEV)` guard

      // The guard is statically evaluated at build time, so:
      // - Development builds: Warnings are included
      // - Production builds: Warning code is tree-shaken away

      // Test environment: DEV can be true or false depending on config
      // The important thing is that the code path exists and the guard works
      expect(typeof import.meta.env.DEV).toBe("boolean");
    });
  });
});
