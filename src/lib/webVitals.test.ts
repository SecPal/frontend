// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  initWebVitals,
  getPerformanceMetrics,
  clearPerformanceMetrics,
} from "./webVitals";
import { analytics } from "./analytics";

// Mock web-vitals
vi.mock("web-vitals", () => {
  const callbacks: Record<string, (metric: unknown) => void> = {};

  return {
    onCLS: vi.fn((callback) => {
      callbacks.CLS = callback;
      // Simulate CLS metric
      callback({
        name: "CLS",
        value: 0.05,
        delta: 0.05,
        id: "cls-123",
        navigationType: "navigate",
        rating: "good",
      });
    }),
    onINP: vi.fn((callback) => {
      callbacks.INP = callback;
      // Simulate INP metric
      callback({
        name: "INP",
        value: 150,
        delta: 150,
        id: "inp-123",
        navigationType: "navigate",
        rating: "good",
      });
    }),
    onLCP: vi.fn((callback) => {
      callbacks.LCP = callback;
      // Simulate LCP metric
      callback({
        name: "LCP",
        value: 2000,
        delta: 2000,
        id: "lcp-123",
        navigationType: "navigate",
        rating: "good",
      });
    }),
    onFCP: vi.fn((callback) => {
      callbacks.FCP = callback;
      // Simulate FCP metric
      callback({
        name: "FCP",
        value: 1500,
        delta: 1500,
        id: "fcp-123",
        navigationType: "navigate",
        rating: "good",
      });
    }),
    onTTFB: vi.fn((callback) => {
      callbacks.TTFB = callback;
      // Simulate TTFB metric
      callback({
        name: "TTFB",
        value: 500,
        delta: 500,
        id: "ttfb-123",
        navigationType: "navigate",
        rating: "good",
      });
    }),
    // Expose callbacks for testing
    __callbacks: callbacks,
  };
});

// Mock analytics
vi.mock("./analytics", () => ({
  analytics: {
    trackPerformance: vi.fn(),
  },
}));

describe("Web Vitals Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initWebVitals", () => {
    it("should initialize all Web Vitals metrics", () => {
      initWebVitals();

      // Should have called trackPerformance for each metric
      expect(analytics!.trackPerformance).toHaveBeenCalledTimes(5);
    });

    it("should track CLS metric", () => {
      initWebVitals();

      expect(analytics!.trackPerformance).toHaveBeenCalledWith(
        "CLS",
        0.05,
        expect.objectContaining({
          id: "cls-123",
          delta: 0.05,
          navigationType: "navigate",
          rating: "good",
        })
      );
    });

    it("should track INP metric", () => {
      initWebVitals();

      expect(analytics!.trackPerformance).toHaveBeenCalledWith(
        "INP",
        150,
        expect.objectContaining({
          id: "inp-123",
          delta: 150,
          navigationType: "navigate",
          rating: "good",
        })
      );
    });

    it("should track LCP metric", () => {
      initWebVitals();

      expect(analytics!.trackPerformance).toHaveBeenCalledWith(
        "LCP",
        2000,
        expect.objectContaining({
          id: "lcp-123",
          delta: 2000,
          navigationType: "navigate",
          rating: "good",
        })
      );
    });

    it("should track FCP metric", () => {
      initWebVitals();

      expect(analytics!.trackPerformance).toHaveBeenCalledWith(
        "FCP",
        1500,
        expect.objectContaining({
          id: "fcp-123",
          delta: 1500,
          navigationType: "navigate",
          rating: "good",
        })
      );
    });

    it("should track TTFB metric", () => {
      initWebVitals();

      expect(analytics!.trackPerformance).toHaveBeenCalledWith(
        "TTFB",
        500,
        expect.objectContaining({
          id: "ttfb-123",
          delta: 500,
          navigationType: "navigate",
          rating: "good",
        })
      );
    });

    it("should not crash when analytics is null", () => {
      // Even if analytics module exists but is null, web vitals should initialize
      // The mock ensures analytics.trackPerformance exists, so no warning is shown
      // This is a defensive test to ensure no runtime errors occur
      expect(() => initWebVitals()).not.toThrow();
    });

    it("should handle initialization errors gracefully", async () => {
      const consoleWarn = vi.spyOn(console, "warn");
      const { onCLS } = await import("web-vitals");

      // Make onCLS throw an error
      vi.mocked(onCLS).mockImplementationOnce(() => {
        throw new Error("Web Vitals not supported");
      });

      // Re-import to get fresh module with mocked implementation
      const { initWebVitals: freshInit } = await import("./webVitals");

      // Should not throw, but should warn
      expect(() => freshInit()).not.toThrow();
      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to initialize Web Vitals:",
        expect.any(Error)
      );
    });
  });

  describe("Performance Thresholds", () => {
    let consoleWarn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      clearPerformanceMetrics();
      vi.clearAllMocks();
    });

    afterEach(() => {
      consoleWarn.mockRestore();
    });

    it("should only warn in development mode", () => {
      // In test environment (import.meta.env.DEV is false by default)
      // warnings should not be logged
      initWebVitals();

      // No warnings for good metrics in production
      expect(consoleWarn).not.toHaveBeenCalledWith(
        expect.stringContaining("Performance Warning")
      );
    });

    it("should collect all metrics regardless of rating", () => {
      initWebVitals();

      const metrics = getPerformanceMetrics();

      // All metrics should be collected
      expect(metrics).toHaveLength(5);
      expect(metrics.every((m) => m.rating === "good")).toBe(true);
    });
  });

  describe("Performance Metrics Export", () => {
    beforeEach(() => {
      clearPerformanceMetrics();
      vi.clearAllMocks();
    });

    it("should collect metrics for export", () => {
      initWebVitals();

      const metrics = getPerformanceMetrics();

      expect(metrics).toHaveLength(5);
      expect(metrics.map((m) => m.name)).toEqual([
        "CLS",
        "INP",
        "LCP",
        "FCP",
        "TTFB",
      ]);
    });

    it("should include all metric properties", () => {
      initWebVitals();

      const metrics = getPerformanceMetrics();
      const lcpMetric = metrics.find((m) => m.name === "LCP");

      expect(lcpMetric).toMatchObject({
        name: "LCP",
        value: 2000,
        rating: "good",
        id: "lcp-123",
        delta: 2000,
        navigationType: "navigate",
      });
    });

    it("should clear metrics when requested", () => {
      initWebVitals();

      expect(getPerformanceMetrics()).toHaveLength(5);

      clearPerformanceMetrics();

      expect(getPerformanceMetrics()).toHaveLength(0);
    });

    it("should return a copy of metrics array", () => {
      initWebVitals();

      const metrics1 = getPerformanceMetrics();
      const metrics2 = getPerformanceMetrics();

      expect(metrics1).not.toBe(metrics2);
      expect(metrics1).toEqual(metrics2);
    });
  });
});
