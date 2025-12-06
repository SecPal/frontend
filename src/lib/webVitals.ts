// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";
import { analytics } from "./analytics";

/**
 * Web Vitals metrics for performance monitoring
 * - CLS (Cumulative Layout Shift): Visual stability
 * - INP (Interaction to Next Paint): Responsiveness (replaces FID)
 * - LCP (Largest Contentful Paint): Loading performance
 * - FCP (First Contentful Paint): Perceived load speed
 * - TTFB (Time to First Byte): Server response time
 */

/**
 * Performance thresholds based on Core Web Vitals recommendations
 * @see https://web.dev/articles/vitals
 * @see https://github.com/GoogleChrome/lighthouse-ci
 *
 * Aligned with Lighthouse CI configuration in lighthouserc.cjs
 */
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // milliseconds
  CLS: { good: 0.1, needsImprovement: 0.25 }, // score
  INP: { good: 200, needsImprovement: 500 }, // milliseconds
  FCP: { good: 1800, needsImprovement: 3000 }, // milliseconds
  TTFB: { good: 800, needsImprovement: 1800 }, // milliseconds
} as const;

/**
 * Collected metrics for export/dashboard
 */
const collectedMetrics: Metric[] = [];

/**
 * Get display unit for metric value
 */
function getMetricUnit(metricName: string): string {
  return ["LCP", "INP", "FCP", "TTFB"].includes(metricName) ? "ms" : "";
}

/**
 * Get current severity level for a metric based on rating
 */
function getSeverity(
  rating: Metric["rating"]
): "good" | "needs-improvement" | "poor" {
  if (rating === "good") return "good";
  if (rating === "needs-improvement") return "needs-improvement";
  return "poor";
}

/**
 * Check if metric violates thresholds and log warning in development
 */
function checkThreshold(metric: Metric): void {
  const rating = metric.rating;

  // Only log warnings in development mode
  if (import.meta.env.DEV && rating !== "good") {
    const severity = getSeverity(rating);
    const unit = getMetricUnit(metric.name);

    const message =
      severity === "poor"
        ? `⚠️ Performance Warning: ${metric.name} (${metric.value}${unit}) exceeds threshold`
        : `⚠️ Performance Warning: ${metric.name} (${metric.value}${unit}) needs improvement`;

    const threshold =
      PERFORMANCE_THRESHOLDS[
        metric.name as keyof typeof PERFORMANCE_THRESHOLDS
      ];

    console.warn(message, {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      threshold,
    });
  }
}

/**
 * Report Web Vitals metric to analytics
 */
function reportWebVital(metric: Metric): void {
  // Store metric for export
  collectedMetrics.push(metric);

  // Check thresholds and log warnings (development only)
  checkThreshold(metric);

  if (!analytics) {
    console.warn("Analytics not available, skipping Web Vitals reporting");
    return;
  }

  analytics.trackPerformance(metric.name, metric.value, {
    id: metric.id,
    delta: metric.delta,
    navigationType: metric.navigationType,
    rating: metric.rating,
  });
}

/**
 * Get all collected performance metrics
 * Useful for dashboards and performance analysis
 */
export function getPerformanceMetrics(): Metric[] {
  return [...collectedMetrics];
}

/**
 * Clear collected metrics
 * Useful for testing or resetting performance tracking
 */
export function clearPerformanceMetrics(): void {
  collectedMetrics.length = 0;
}

/**
 * Initialize Web Vitals tracking
 * Call this once when the app starts
 */
export function initWebVitals(): void {
  if (typeof window === "undefined") {
    console.warn("Web Vitals not available in non-browser environment");
    return;
  }

  try {
    // Cumulative Layout Shift (visual stability)
    // Good: < 0.1, Needs Improvement: 0.1-0.25, Poor: > 0.25
    onCLS(reportWebVital);

    // Interaction to Next Paint (responsiveness - replaces FID in Web Vitals v4)
    // Good: < 200ms, Needs Improvement: 200-500ms, Poor: > 500ms
    onINP(reportWebVital);

    // Largest Contentful Paint (loading performance)
    // Good: < 2.5s, Needs Improvement: 2.5-4s, Poor: > 4s
    onLCP(reportWebVital);

    // First Contentful Paint (perceived load speed)
    // Good: < 1.8s, Needs Improvement: 1.8-3s, Poor: > 3s
    onFCP(reportWebVital);

    // Time to First Byte (server response time)
    // Good: < 800ms, Needs Improvement: 800-1800ms, Poor: > 1800ms
    onTTFB(reportWebVital);
  } catch (error) {
    // Non-critical: App works without Web Vitals tracking
    console.warn("Failed to initialize Web Vitals:", error);
  }
}
