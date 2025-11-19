// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheMonitor } from "./cacheMonitor";

describe("CacheMonitor", () => {
  let monitor: CacheMonitor;

  beforeEach(() => {
    monitor = new CacheMonitor();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("recordHit", () => {
    it("should increment hit counter", () => {
      monitor.recordHit();
      expect(monitor.getMetrics().hits).toBe(1);

      monitor.recordHit();
      expect(monitor.getMetrics().hits).toBe(2);
    });
  });

  describe("recordMiss", () => {
    it("should increment miss counter", () => {
      monitor.recordMiss();
      expect(monitor.getMetrics().misses).toBe(1);

      monitor.recordMiss();
      expect(monitor.getMetrics().misses).toBe(2);
    });
  });

  describe("getHitRatio", () => {
    it("should calculate hit ratio correctly", () => {
      monitor.recordHit();
      monitor.recordHit();
      monitor.recordHit();
      monitor.recordMiss();

      // 3 hits / 4 total = 0.75
      expect(monitor.getHitRatio()).toBe(0.75);
    });

    it("should return 0 when no operations recorded", () => {
      expect(monitor.getHitRatio()).toBe(0);
    });

    it("should handle only hits", () => {
      monitor.recordHit();
      expect(monitor.getHitRatio()).toBe(1);
    });

    it("should handle only misses", () => {
      monitor.recordMiss();
      expect(monitor.getHitRatio()).toBe(0);
    });
  });

  describe("recordLookupTime", () => {
    it("should record lookup times", () => {
      monitor.recordLookupTime(10);
      monitor.recordLookupTime(20);
      monitor.recordLookupTime(30);

      expect(monitor.getAverageLookupTime()).toBe(20);
    });

    it("should limit number of samples", () => {
      // Record 150 samples
      for (let i = 0; i < 150; i++) {
        monitor.recordLookupTime(i);
      }

      // Should only keep last 100 samples (50-149)
      expect(monitor.getAverageLookupTime()).toBeGreaterThan(90);
    });
  });

  describe("getAverageLookupTime", () => {
    it("should calculate average correctly", () => {
      monitor.recordLookupTime(10);
      monitor.recordLookupTime(20);
      monitor.recordLookupTime(30);

      expect(monitor.getAverageLookupTime()).toBe(20);
    });

    it("should return 0 when no times recorded", () => {
      expect(monitor.getAverageLookupTime()).toBe(0);
    });
  });

  describe("getP95LookupTime", () => {
    it("should calculate p95 correctly", () => {
      // Record 20 samples (0-19)
      for (let i = 0; i < 20; i++) {
        monitor.recordLookupTime(i * 10);
      }

      // p95 of 0-190 is index 19 = 190
      expect(monitor.getP95LookupTime()).toBe(190);
    });

    it("should return 0 when no times recorded", () => {
      expect(monitor.getP95LookupTime()).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("should return all metrics", () => {
      monitor.recordHit();
      monitor.recordHit();
      monitor.recordMiss();
      monitor.recordLookupTime(10);
      monitor.recordLookupTime(20);

      monitor.recordMiss();
      monitor.recordLookupTime(10);

      expect(monitor.getMetrics()).toBeDefined();
      expect(monitor.getMetrics().hits).toBe(2);

      monitor.reset();
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      monitor.recordHit();
      monitor.recordMiss();
      monitor.recordLookupTime(10);

      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.total).toBe(0);
      expect(metrics.avgLookupTime).toBe("0.00");
    });
  });

  describe("reportMetrics", () => {
    it("should report metrics every 10 operations", () => {
      const consoleSpy = vi.spyOn(console, "log");

      // Record 9 operations - should not report
      for (let i = 0; i < 9; i++) {
        monitor.recordHit();
      }
      expect(consoleSpy).not.toHaveBeenCalled();

      // 10th operation - should report
      monitor.recordHit();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
