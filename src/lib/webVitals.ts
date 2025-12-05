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
 * Report Web Vitals metric to analytics
 */
function reportWebVital(metric: Metric): void {
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

    // Only log in development mode to avoid cluttering production logs
    if (import.meta.env.DEV) {
      console.log("Web Vitals tracking initialized");
    }
  } catch (error) {
    // Non-critical: App works without Web Vitals tracking
    console.warn("Failed to initialize Web Vitals:", error);
  }
}
