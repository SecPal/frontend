// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Cache performance monitoring utility
 *
 * Tracks cache hit/miss ratio, lookup times, and storage quota
 * for performance analysis and optimization.
 *
 * Singleton pattern ensures consistent metrics across app lifecycle.
 *
 * @example
 * ```typescript
 * import { cacheMonitor } from '@/lib/cacheMonitor';
 *
 * // Record cache hit
 * cacheMonitor.recordHit();
 *
 * // Record cache miss
 * cacheMonitor.recordMiss();
 *
 * // Get metrics
 * const metrics = cacheMonitor.getMetrics();
 * console.log(`Cache hit ratio: ${metrics.hitRatio}%`);
 * ```
 */
export class CacheMonitor {
  private hits = 0;
  private misses = 0;
  private lookupTimes: number[] = [];
  private maxLookupSamples = 100;

  /**
   * Record a cache hit
   */
  recordHit(): void {
    this.hits++;
    this.reportMetrics();
  }

  /**
   * Record a cache miss
   */
  recordMiss(): void {
    this.misses++;
    this.reportMetrics();
  }

  /**
   * Record cache lookup time
   *
   * @param timeMs - Lookup time in milliseconds
   */
  recordLookupTime(timeMs: number): void {
    this.lookupTimes.push(timeMs);

    // Keep only last N samples to avoid memory leak
    if (this.lookupTimes.length > this.maxLookupSamples) {
      this.lookupTimes.shift();
    }
  }

  /**
   * Get cache hit ratio (0-1)
   *
   * @returns Hit ratio as decimal (0 = 0%, 1 = 100%)
   */
  getHitRatio(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  /**
   * Get average cache lookup time
   *
   * @returns Average lookup time in milliseconds
   */
  getAverageLookupTime(): number {
    if (this.lookupTimes.length === 0) return 0;
    const sum = this.lookupTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.lookupTimes.length;
  }

  /**
   * Get p95 cache lookup time
   *
   * @returns 95th percentile lookup time in milliseconds
   */
  getP95LookupTime(): number {
    if (this.lookupTimes.length === 0) return 0;

    const sorted = [...this.lookupTimes].sort((a, b) => a - b);
    const index = Math.ceil((sorted.length - 1) * 0.95);
    return sorted[index] ?? 0;
  }

  /**
   * Get comprehensive cache metrics
   *
   * @returns Object with all cache metrics
   */
  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      total: this.hits + this.misses,
      hitRatio: this.getHitRatio(),
      hitRatioPercent: (this.getHitRatio() * 100).toFixed(2),
      avgLookupTime: this.getAverageLookupTime().toFixed(2),
      p95LookupTime: this.getP95LookupTime().toFixed(2),
    };
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.lookupTimes = [];
  }

  /**
   * Report metrics to analytics (if available)
   *
   * This is called automatically on each hit/miss.
   * Can be extended to send to analytics service.
   */
  private reportMetrics(): void {
    // Only report every 10 operations to avoid performance impact
    const total = this.hits + this.misses;
    if (total % 10 !== 0) return;

    const metrics = this.getMetrics();

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log("[CacheMonitor] Metrics:", metrics);
    }

    // Note: Analytics is local-only by design (privacy-first architecture).
    // Cache metrics are logged to console in dev mode only.
    // See Issue #167 for privacy-first design rationale.
  }
}

/**
 * Global cache monitor instance
 *
 * Use this singleton instance throughout the app for consistent metrics
 */
export const cacheMonitor = new CacheMonitor();
