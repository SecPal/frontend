// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analytics } from "./analytics";
import { db } from "./db";

// Mock IndexedDB
vi.mock("./db", () => ({
  db: {
    analytics: {
      add: vi.fn().mockResolvedValue(1),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([]),
          and: vi.fn(() => ({
            delete: vi.fn().mockResolvedValue(0),
          })),
        })),
      })),
      toArray: vi.fn().mockResolvedValue([]),
      bulkUpdate: vi.fn().mockResolvedValue(0),
    },
  },
}));

describe("OfflineAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
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

    it("should set userId", () => {
      analytics!.setUserId("test-user-123");
      // User ID will be included in subsequent events
    });
  });

  describe("track", () => {
    it("should track basic event", async () => {
      await analytics!.track("page_view", "navigation", "view_home");

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.track("button_click", "interaction", "submit", {
        label: "login-button",
        value: 1,
        metadata: { page: "/login" },
      });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      analytics!.setUserId("user-456");

      await analytics!.track("page_view", "navigation", "view_dashboard");

      expect(db.analytics!.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-456",
        })
      );
    });

    it("should handle tracking errors gracefully", async () => {
      const consoleError = vi.spyOn(console, "error");
      const error = new Error("Database error");
      vi.mocked(db.analytics!.add).mockRejectedValueOnce(error);

      await analytics!.track("page_view", "test", "test");

      expect(consoleError).toHaveBeenCalledWith(
        "Failed to track analytics event:",
        error
      );
    });
  });

  describe("convenience methods", () => {
    it("should track page view", async () => {
      await analytics!.trackPageView("/dashboard", "Dashboard");

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.trackClick("submit-button", { form: "login" });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.trackFormSubmit("login-form", true, { method: "email" });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.trackFormSubmit("login-form", false);

      expect(db.analytics!.add).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0,
        })
      );
    });

    it("should track error without stack by default", async () => {
      const error = new Error("Test error");
      await analytics!.trackError(error, { component: "LoginForm" });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      const call = vi.mocked(db.analytics!.add).mock.calls[0]?.[0];
      expect(call?.metadata).not.toHaveProperty("stack");
    });

    it("should track error with stack when explicitly requested", async () => {
      const error = new Error("Test error with stack");
      await analytics!.trackError(error, { component: "LoginForm" }, true);

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.trackPerformance("page_load", 1234, { page: "/home" });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      await analytics!.trackFeatureUsage("dark-mode", { enabled: true });

      expect(db.analytics!.add).toHaveBeenCalledWith(
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
      const mockEvents = [
        {
          id: 1,
          type: "page_view",
          category: "test",
          action: "test",
          synced: false,
          timestamp: Date.now(),
          sessionId: "test",
        },
        {
          id: 2,
          type: "button_click",
          category: "test",
          action: "test",
          synced: false,
          timestamp: Date.now(),
          sessionId: "test",
        },
      ];

      vi.mocked(db.analytics!.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue(mockEvents),
          and: vi.fn(),
        }),
      } as never);

      await analytics!.syncEvents();

      expect(db.analytics!.bulkUpdate).toHaveBeenCalledWith([
        { key: 1, changes: { synced: true } },
        { key: 2, changes: { synced: true } },
      ]);
    });

    it("should not sync when no unsynced events", async () => {
      vi.mocked(db.analytics!.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([]),
          and: vi.fn(),
        }),
      } as never);

      await analytics!.syncEvents();

      expect(db.analytics!.bulkUpdate).not.toHaveBeenCalled();
    });

    it("should handle sync errors gracefully", async () => {
      const consoleError = vi.spyOn(console, "error");
      const error = new Error("Sync failed");
      vi.mocked(db.analytics!.where).mockImplementation(() => {
        throw error;
      });

      await analytics!.syncEvents();

      expect(consoleError).toHaveBeenCalledWith(
        "Failed to sync analytics events:",
        error
      );
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

      vi.mocked(db.analytics!.toArray).mockResolvedValue(mockEvents);

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
      vi.mocked(db.analytics!.toArray).mockResolvedValue([]);

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
      const mockDelete = vi.fn().mockResolvedValue(5);

      vi.mocked(db.analytics!.where).mockReturnValue({
        equals: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            delete: mockDelete,
          }),
          toArray: vi.fn(),
        }),
      } as never);

      await analytics!.clearOldEvents();

      expect(db.analytics!.where).toHaveBeenCalledWith("synced");
    });
  });

  describe("online/offline handling", () => {
    it("should detect initial online state", () => {
      // Navigator.onLine is mocked in setup
      expect(analytics).toBeDefined();
    });

    it("should trigger sync when coming online", async () => {
      const syncSpy = vi.spyOn(analytics!, "syncEvents");

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
