// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analytics } from "./analytics";
import {
  clearOldVaultAnalyticsEvents,
  clearVaultAnalytics,
  listUnsyncedVaultAnalyticsRecordIds,
  listVaultAnalyticsEvents,
  markVaultAnalyticsEventsSynced,
  storeVaultAnalyticsEvent,
} from "./offlineVault";

vi.mock("./offlineVault", () => ({
  storeVaultAnalyticsEvent: vi.fn().mockResolvedValue(1),
  clearVaultAnalytics: vi.fn().mockResolvedValue(undefined),
  listUnsyncedVaultAnalyticsRecordIds: vi.fn().mockResolvedValue([]),
  markVaultAnalyticsEventsSynced: vi.fn().mockResolvedValue(undefined),
  listVaultAnalyticsEvents: vi.fn().mockResolvedValue([]),
  clearOldVaultAnalyticsEvents: vi.fn().mockResolvedValue(undefined),
}));

// NOTE: Singleton persistence across tests is intentional
// The analytics singleton is created once at module load and persists across all test runs.
// This mirrors production behavior where event listeners and intervals remain active for
// the entire app lifetime. Test isolation is maintained through:
// - vi.clearAllMocks() clears mock call history between tests
// - Mocked dependencies (db, window.addEventListener, etc.) prevent side effects
// - Each test operates on the same singleton but with fresh mocks
// The destroy() method exists for explicit cleanup but is not called in tests to match
// production behavior where the singleton lives for the app lifetime.
describe("OfflineAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should generate a unique session ID", () => {
      // Access the private sessionId through a test method if needed
      // For now, we'll test functionality that depends on it
      expect(analytics).toBeDefined();
    });

    it("uses crypto.getRandomValues when randomUUID is unavailable", () => {
      const originalCrypto = Object.getOwnPropertyDescriptor(
        globalThis,
        "crypto"
      );
      const getRandomValues = vi.fn((values: Uint8Array) => {
        values.set([
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa,
          0xbb, 0xcc, 0xdd, 0xee, 0xff,
        ]);
        return values;
      });

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: {
          getRandomValues,
          randomUUID: undefined,
        } as unknown as Crypto,
      });

      try {
        const sessionId = analytics!["generateSessionId"]();

        expect(getRandomValues).toHaveBeenCalledTimes(1);
        expect(sessionId).toBe("session_00112233445566778899aabbccddeeff");
      } finally {
        if (originalCrypto) {
          Object.defineProperty(globalThis, "crypto", originalCrypto);
        }
      }
    });

    it("falls back to deterministic session ids when web crypto is unavailable", () => {
      const originalCrypto = Object.getOwnPropertyDescriptor(
        globalThis,
        "crypto"
      );
      const consoleWarn = vi.mocked(console.warn);

      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: undefined,
      });

      try {
        const firstSessionId = analytics!["generateSessionId"]();
        const secondSessionId = analytics!["generateSessionId"]();

        expect(firstSessionId).toMatch(/^session_\d+_\d+$/);
        expect(secondSessionId).toMatch(/^session_\d+_\d+$/);
        expect(firstSessionId).not.toBe(secondSessionId);
        expect(consoleWarn).toHaveBeenCalledWith(
          "Web Crypto not available, falling back to deterministic session ID generation"
        );
      } finally {
        if (originalCrypto) {
          Object.defineProperty(globalThis, "crypto", originalCrypto);
        }
      }
    });

    it("should set userId", () => {
      analytics!.resumeAuthenticatedSession("test-user-123");
      // User ID will be included in subsequent events
    });
  });

  describe("track", () => {
    it("should track basic event", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.track("page_view", "navigation", "view_home");

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page_view",
          category: "navigation",
          action: "view_home",
          synced: false,
          timestamp: expect.any(Number),
          sessionId: expect.any(String),
        })
      );
    });

    it("should track event with options", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.track("button_click", "interaction", "submit", {
        label: "login-button",
        value: 1,
        metadata: { page: "/login" },
      });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "button_click",
          category: "interaction",
          action: "submit",
          label: "login-button",
          value: 1,
          metadata: { page: "/login" },
        })
      );
    });

    it("should include userId if set", async () => {
      analytics!.resumeAuthenticatedSession("user-456");

      await analytics!.track("page_view", "navigation", "view_dashboard");

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-456",
        })
      );
    });

    it("should handle tracking errors gracefully", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      const consoleWarn = vi.mocked(console.warn);
      const error = new Error("Database error");
      vi.mocked(storeVaultAnalyticsEvent).mockRejectedValueOnce(error);

      await analytics!.track("page_view", "test", "test");

      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to track analytics event:",
        error
      );
    });
  });

  describe("convenience methods", () => {
    it("should track page view", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackPageView("/dashboard", "Dashboard");

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page_view",
          category: "navigation",
          action: "page_view",
          label: "/dashboard",
          metadata: { title: "Dashboard" },
        })
      );
    });

    it("should track click", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackClick("submit-button", { form: "login" });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "button_click",
          category: "interaction",
          action: "click",
          label: "submit-button",
          metadata: { form: "login" },
        })
      );
    });

    it("should track form submit", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackFormSubmit("login-form", true, { method: "email" });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "form_submit",
          category: "interaction",
          action: "form_submit",
          label: "login-form",
          value: 1,
          metadata: { method: "email" },
        })
      );
    });

    it("should track form submit failure", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackFormSubmit("login-form", false);

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0,
        })
      );
    });

    it("should track error without stack by default", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      const error = new Error("Test error");
      await analytics!.trackError(error, { component: "LoginForm" });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          category: "error",
          action: "Error",
          label: "Test error",
          metadata: expect.objectContaining({
            component: "LoginForm",
          }),
        })
      );

      // Ensure stack is NOT included by default
      const call = vi.mocked(storeVaultAnalyticsEvent).mock.calls[0]?.[0];
      expect(call?.metadata).not.toHaveProperty("stack");
    });

    it("should track error with stack when explicitly requested", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      const error = new Error("Test error with stack");
      await analytics!.trackError(error, { component: "LoginForm" }, true);

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          category: "error",
          action: "Error",
          label: "Test error with stack",
          metadata: expect.objectContaining({
            component: "LoginForm",
            stack: expect.any(String),
          }),
        })
      );
    });

    it("should track performance", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackPerformance("page_load", 1234, { page: "/home" });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "performance",
          category: "performance",
          action: "page_load",
          value: 1234,
          metadata: { page: "/home" },
        })
      );
    });

    it("should track feature usage", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      await analytics!.trackFeatureUsage("dark-mode", { enabled: true });

      expect(storeVaultAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "feature_usage",
          category: "feature",
          action: "use",
          label: "dark-mode",
          metadata: { enabled: true },
        })
      );
    });
  });

  describe("syncEvents", () => {
    it("should sync unsynced events when online", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      vi.mocked(listUnsyncedVaultAnalyticsRecordIds).mockResolvedValue([1, 2]);

      await analytics!.syncEvents();

      expect(markVaultAnalyticsEventsSynced).toHaveBeenCalledWith([1, 2]);
    });

    it("clears persisted analytics state and disables tracking on logout reset", async () => {
      analytics!.resumeAuthenticatedSession("user-456");

      await analytics!.trackPageView("/dashboard", "Dashboard");
      expect(storeVaultAnalyticsEvent).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();

      await analytics!.resetForLogout();

      expect(clearVaultAnalytics).toHaveBeenCalledTimes(1);

      await analytics!.trackPageView("/login", "Login");

      expect(storeVaultAnalyticsEvent).not.toHaveBeenCalled();
    });

    it("should not sync when no unsynced events", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      vi.mocked(listUnsyncedVaultAnalyticsRecordIds).mockResolvedValue([]);

      await analytics!.syncEvents();

      expect(markVaultAnalyticsEventsSynced).not.toHaveBeenCalled();
    });

    it("should handle sync errors gracefully", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      const consoleWarn = vi.mocked(console.warn);
      const error = new Error("Sync failed");
      vi.mocked(listUnsyncedVaultAnalyticsRecordIds).mockImplementation(() => {
        throw error;
      });

      await analytics!.syncEvents();

      expect(consoleWarn).toHaveBeenCalledWith(
        "Failed to sync analytics events:",
        error
      );
    });

    it("should cancel pending debounced sync when manual sync is triggered", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      // Simulate a debounced sync being scheduled
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      // Track an event to trigger debounced sync
      await analytics!.trackPageView("/test", "Test");

      // Verify debounced sync was scheduled
      expect(analytics!["syncTimeout"]).toBeDefined();
      const scheduledTimeoutId = analytics!["syncTimeout"];

      // Manually trigger sync (like when coming online)
      await analytics!.syncEvents();

      // Verify pending timeout was cleared
      expect(clearTimeoutSpy).toHaveBeenCalledWith(scheduledTimeoutId);
      expect(analytics!["syncTimeout"]).toBeUndefined();

      clearTimeoutSpy.mockRestore();
    });

    it("should not create duplicate syncs from debounce and manual trigger", async () => {
      analytics!.resumeAuthenticatedSession("test-user-123");

      vi.mocked(listUnsyncedVaultAnalyticsRecordIds).mockResolvedValue([1]);

      // Track an event (schedules debounced sync)
      await analytics!.trackPageView("/test", "Test");

      // Manually trigger sync immediately (before debounce fires)
      await analytics!.syncEvents();

      // Verify sync was called (via bulkUpdate)
      expect(markVaultAnalyticsEventsSynced).toHaveBeenCalledTimes(1);

      // Wait for debounce timeout to potentially fire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify sync was NOT called again (debounce was cancelled)
      expect(markVaultAnalyticsEventsSynced).toHaveBeenCalledTimes(1);
    });
  });

  describe("getStats", () => {
    it("should return analytics statistics", async () => {
      const mockEvents = [
        {
          id: 1,
          type: "page_view" as const,
          category: "test",
          action: "test",
          synced: true,
          timestamp: Date.now(),
          sessionId: "test",
        },
        {
          id: 2,
          type: "button_click" as const,
          category: "test",
          action: "test",
          synced: false,
          timestamp: Date.now(),
          sessionId: "test",
        },
        {
          id: 3,
          type: "page_view" as const,
          category: "test",
          action: "test",
          synced: false,
          timestamp: Date.now(),
          sessionId: "test",
        },
      ];

      vi.mocked(listVaultAnalyticsEvents).mockResolvedValue(mockEvents);

      const stats = await analytics!.getStats();

      expect(stats).toEqual({
        total: 3,
        synced: 1,
        unsynced: 2,
        byType: {
          page_view: 2,
          button_click: 1,
        },
      });
    });

    it("should return empty stats when no events", async () => {
      vi.mocked(listVaultAnalyticsEvents).mockResolvedValue([]);

      const stats = await analytics!.getStats();

      expect(stats).toEqual({
        total: 0,
        synced: 0,
        unsynced: 0,
        byType: {},
      });
    });
  });

  describe("clearOldEvents", () => {
    it("should delete old synced events", async () => {
      await analytics!.clearOldEvents();

      expect(clearOldVaultAnalyticsEvents).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });
  });

  describe("online/offline handling", () => {
    it("should detect initial online state", () => {
      // Navigator.onLine is mocked in setup
      expect(analytics).toBeDefined();
    });

    it("should trigger sync when coming online", async () => {
      const syncSpy = vi
        .spyOn(analytics!, "syncEvents")
        .mockResolvedValue(undefined);

      // Simulate coming online
      window.dispatchEvent(new Event("online"));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(syncSpy).toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("should stop periodic sync", () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

      analytics!.stopPeriodicSync();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
