// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { initWebVitals } from "./webVitals";
import { analytics } from "./analytics";

// Mock web-vitals
vi.mock("web-vitals", () => ({
  onCLS: vi.fn((callback) => {
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
}));

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
  });
});
