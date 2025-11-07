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

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isOnline = typeof navigator !== "undefined" && navigator.onLine;

    // Set up online/offline listeners
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }

    // Start periodic sync
    this.startPeriodicSync();
  }

  /**
   * Generate a unique session ID using cryptographically secure random
   * @throws {Error} If crypto.randomUUID is not available (unsupported browser)
   */
  private generateSessionId(): string {
    if (typeof crypto === "undefined" || !crypto.randomUUID) {
      throw new Error(
        "crypto.randomUUID is not available. This browser does not support secure random ID generation."
      );
    }
    return `session_${crypto.randomUUID()}`;
  }

  /**
   * Set the current user ID for analytics
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Track an analytics event
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

      // If online, try to sync immediately
      if (this.isOnline) {
        await this.syncEvents();
      }
    } catch (error) {
      console.error("Failed to track analytics event:", error);
    }
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
   */
  async trackError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.track("error", "error", error.name, {
      label: error.message,
      metadata: {
        ...context,
        stack: error.stack,
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
   * Sync unsynced events to the server
   */
  async syncEvents(): Promise<void> {
    if (!this.isOnline) return;

    try {
      // Get all unsynced events
      const unsyncedEvents = await db.analytics
        .where("synced")
        .equals(0)
        .toArray();

      if (unsyncedEvents.length === 0) return;

      // In a real implementation, this would send to an analytics endpoint
      // For now, we'll just mark them as synced
      // TODO: Implement actual sync to backend

      // Simulate network request
      console.log(`Syncing ${unsyncedEvents.length} analytics events...`);

      // Mark events as synced
      const eventIds = unsyncedEvents.map((e) => e.id!).filter((id) => id);
      await db.analytics.bulkUpdate(
        eventIds.map((id) => ({
          key: id,
          changes: { synced: true },
        }))
      );

      console.log(`Successfully synced ${eventIds.length} events`);
    } catch (error) {
      console.error("Failed to sync analytics events:", error);
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

// Export singleton instance
export const analytics = new OfflineAnalytics();
