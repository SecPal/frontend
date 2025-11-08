// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db, type AnalyticsEvent, type AnalyticsEventType } from "./db";

// Re-export types for external use
export type { AnalyticsEvent, AnalyticsEventType };

class OfflineAnalytics {
  private sessionId: string;
  private userId?: string;
  private isOnline: boolean;
  private syncInterval?: number;
  private syncTimeout?: number;
  private onlineHandler: () => void;
  private offlineHandler: () => void;
  private isSyncing: boolean = false;
  private isDestroyed: boolean = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isOnline = typeof navigator !== "undefined" && navigator.onLine;

    // Bind event handlers for cleanup
    this.onlineHandler = () => this.handleOnline();
    this.offlineHandler = () => this.handleOffline();

    // Set up online/offline listeners
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
    }

    // Start periodic sync
    this.startPeriodicSync();
  }

  /**
   * Generate a unique session ID using cryptographically secure random
   * Falls back to timestamp + Math.random for older browsers
   */
  private generateSessionId(): string {
    // Prefer crypto.randomUUID for cryptographic security
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `session_${crypto.randomUUID()}`;
    }

    // Fallback for older browsers using Math.random()
    // SECURITY NOTE: This is acceptable because:
    // 1. Session IDs are NOT used for authentication or authorization
    // 2. They are only used for grouping analytics events (non-security context)
    // 3. Collision risk is negligible (timestamp ensures uniqueness across sessions)
    // 4. No PII is stored (privacy-first design)
    // 5. Primary path uses crypto.randomUUID (cryptographically secure)
    console.warn(
      "crypto.randomUUID not available, falling back to timestamp-based session ID"
    );
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Set the current user ID for analytics
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track an analytics event
   * @param metadata - Additional context (do not include PII or sensitive data)
   */
  async track(
    type: AnalyticsEventType,
    category: string,
    action: string,
    options?: {
      label?: string;
      value?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    // Prevent tracking after destroy
    if (this.isDestroyed) {
      console.warn(
        "Analytics instance has been destroyed, ignoring track call"
      );
      return;
    }

    const event: AnalyticsEvent = {
      type,
      category,
      action,
      label: options?.label,
      value: options?.value,
      metadata: options?.metadata,
      timestamp: Date.now(),
      synced: false,
      sessionId: this.sessionId,
      userId: this.userId,
    };

    try {
      // Store event in IndexedDB
      await db.analytics.add(event);

      // If online, debounce sync to avoid excessive syncing
      if (this.isOnline) {
        this.debouncedSync();
      }
    } catch (error) {
      console.error("Failed to track analytics event:", error);
    }
  }

  /**
   * Debounced sync - waits 1 second after last event before syncing
   */
  private debouncedSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = window.setTimeout(() => {
      this.syncEvents();
      this.syncTimeout = undefined;
    }, 1000); // 1 second debounce
  }

  /**
   * Track a page view
   */
  async trackPageView(path: string, title?: string): Promise<void> {
    await this.track("page_view", "navigation", "page_view", {
      label: path,
      metadata: { title },
    });
  }

  /**
   * Track a button click
   */
  async trackClick(
    elementId: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track("button_click", "interaction", "click", {
      label: elementId,
      metadata: context,
    });
  }

  /**
   * Track a form submission
   */
  async trackFormSubmit(
    formName: string,
    success: boolean,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.track("form_submit", "interaction", "form_submit", {
      label: formName,
      value: success ? 1 : 0,
      metadata,
    });
  }

  /**
   * Track an error
   * @param error - Error object
   * @param context - Additional context (do not include sensitive data)
   * @param includeStack - Whether to include full stack trace (default: false). Stack traces may contain sensitive file paths.
   */
  async trackError(
    error: Error,
    context?: Record<string, unknown>,
    includeStack: boolean = false
  ): Promise<void> {
    await this.track("error", "error", error.name, {
      label: error.message,
      metadata: {
        ...context,
        ...(includeStack ? { stack: error.stack } : {}),
      },
    });
  }

  /**
   * Track a performance metric
   */
  async trackPerformance(
    metric: string,
    value: number,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.track("performance", "performance", metric, {
      value,
      metadata,
    });
  }

  /**
   * Track feature usage
   */
  async trackFeatureUsage(
    feature: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await this.track("feature_usage", "feature", "use", {
      label: feature,
      metadata,
    });
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.isOnline = true;
    this.syncEvents();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Start periodic sync (every 5 minutes)
   */
  private startPeriodicSync(): void {
    if (typeof window === "undefined") return;

    this.syncInterval = window.setInterval(
      () => {
        if (this.isOnline) {
          this.syncEvents();
        }
      },
      5 * 60 * 1000
    ); // 5 minutes
  }

  /**
   * Stop periodic sync
   */
  stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  /**
   * Clean up resources (event listeners, intervals)
   * Call this when the analytics instance is no longer needed (e.g., in tests)
   *
   * Note: For the singleton instance, this is intentionally only called during
   * test cleanup. In production, event listeners persist for the app lifetime.
   */
  destroy(): void {
    this.isDestroyed = true;

    // Remove event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.onlineHandler);
      window.removeEventListener("offline", this.offlineHandler);
    }

    // Clear intervals and timeouts
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = undefined;
    }
  }

  /**
   * Sync unsynced events to the server
   *
   * NOTE: Backend sync is not yet implemented. Events are currently only
   * marked as "synced" locally. In production, this would send events to
   * an analytics endpoint. See README for current limitations.
   */
  async syncEvents(): Promise<void> {
    if (!this.isOnline || this.isDestroyed) return;

    // Prevent concurrent syncs - atomic check and set
    if (this.isSyncing) {
      console.log("Sync already in progress, skipping...");
      return;
    }

    this.isSyncing = true;

    try {
      // Get all unsynced events
      const unsyncedEvents = await db.analytics
        .where("synced")
        .equals(0)
        .toArray();

      if (unsyncedEvents.length === 0) {
        this.isSyncing = false;
        return;
      }

      // TODO: Implement actual sync to backend endpoint
      // In production, this would POST events to /api/analytics
      // For now, we just mark them as synced for local testing

      // Simulate network request
      console.log(`Syncing ${unsyncedEvents.length} analytics events...`);

      // Mark events as synced - single-pass bulk update with proper type narrowing
      const eventsWithId = unsyncedEvents.filter(
        (e): e is AnalyticsEvent & { id: number } => e.id !== undefined
      );

      await db.analytics.bulkUpdate(
        eventsWithId.map((e) => ({
          key: e.id,
          changes: { synced: true },
        }))
      );

      console.log(`Successfully synced ${eventsWithId.length} events`);
    } catch (error) {
      console.error("Failed to sync analytics events:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get analytics stats
   */
  async getStats(): Promise<{
    total: number;
    synced: number;
    unsynced: number;
    byType: Record<AnalyticsEventType, number>;
  }> {
    const allEvents = await db.analytics.toArray();
    const syncedEvents = allEvents.filter((e) => e.synced);
    const unsyncedEvents = allEvents.filter((e) => !e.synced);

    const byType = allEvents.reduce(
      (acc, event) => {
        const type = event.type as AnalyticsEventType;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<AnalyticsEventType, number>
    );

    return {
      total: allEvents.length,
      synced: syncedEvents.length,
      unsynced: unsyncedEvents.length,
      byType,
    };
  }

  /**
   * Clear old synced events (older than 30 days)
   */
  async clearOldEvents(): Promise<void> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    await db.analytics
      .where("synced")
      .equals(1)
      .and((event) => event.timestamp < thirtyDaysAgo)
      .delete();
  }
}

/**
 * Get the singleton analytics instance
 * @throws {Error} If analytics is not available in this environment
 */
export function getAnalytics(): OfflineAnalytics {
  if (!analyticsInstance) {
    throw new Error(
      "Analytics not available in this environment. Browser may not support required PWA features."
    );
  }
  return analyticsInstance;
}

// Export singleton instance with safe initialization
// If initialization fails (e.g., old browser), instance will be null
// Use getAnalytics() for safe access with error handling
//
// NOTE: Singleton persists across tests by design
// - Event listeners remain active for entire app lifetime in production
// - Intervals are intentionally not cleaned up between tests
// - Test isolation is maintained through vi.clearAllMocks() and mocked dependencies
// - This is intentional behavior for a production singleton pattern
// - The destroy() method exists for explicit cleanup when needed (e.g., during app teardown)
let analyticsInstance: OfflineAnalytics | null = null;

try {
  analyticsInstance = new OfflineAnalytics();
} catch (error) {
  console.error(
    "Failed to initialize analytics singleton. This browser may not support required PWA features:",
    error
  );
}

// Backwards compatibility: Direct export (may be null)
// Prefer using getAnalytics() for better error handling
export const analytics = analyticsInstance;
