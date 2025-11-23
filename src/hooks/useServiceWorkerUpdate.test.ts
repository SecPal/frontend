// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useServiceWorkerUpdate } from "./useServiceWorkerUpdate";

// Mock virtual:pwa-register/react
let mockNeedRefresh = false;
let mockOfflineReady = false;
const mockUpdateSW = vi.fn();
let mockOnNeedRefresh: ((needRefresh: boolean) => void) | null = null;
let mockOnOfflineReady: ((offlineReady: boolean) => void) | null = null;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: vi.fn(() => {
    const needRefreshState: [boolean, (value: boolean) => void] = [
      mockNeedRefresh,
      (value: boolean) => {
        mockNeedRefresh = value;
        mockOnNeedRefresh?.(value);
      },
    ];

    const offlineReadyState: [boolean, (value: boolean) => void] = [
      mockOfflineReady,
      (value: boolean) => {
        mockOfflineReady = value;
        mockOnOfflineReady?.(value);
      },
    ];

    return {
      needRefresh: needRefreshState,
      offlineReady: offlineReadyState,
      updateServiceWorker: mockUpdateSW,
    };
  }),
}));

describe("useServiceWorkerUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockOnNeedRefresh = null;
    mockOnOfflineReady = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initialization", () => {
    it("should initialize with needRefresh=false and offlineReady=false", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current.needRefresh).toBe(false);
      expect(result.current.offlineReady).toBe(false);
    });
  });

  describe("State Synchronization", () => {
    it("should sync needRefresh state from service worker", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Initially false
      expect(result.current.needRefresh).toBe(false);

      // Update mock state and rerender
      mockNeedRefresh = true;
      rerender();

      expect(result.current.needRefresh).toBe(true);
    });

    it("should sync offlineReady state from service worker", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Initially false
      expect(result.current.offlineReady).toBe(false);

      // Update mock state and rerender
      mockOfflineReady = true;
      rerender();

      expect(result.current.offlineReady).toBe(true);
    });
  });

  describe("updateServiceWorker()", () => {
    it("should call service worker update function with reload=true", async () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      await act(async () => {
        await result.current.updateServiceWorker();
      });

      expect(mockUpdateSW).toHaveBeenCalledWith(true);
    });

    it("should handle update errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockUpdateSW.mockRejectedValueOnce(new Error("Update failed"));

      const { result } = renderHook(() => useServiceWorkerUpdate());

      await act(async () => {
        await result.current.updateServiceWorker();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[SW] Update failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("close() - Snooze Functionality", () => {
    it("should hide prompt and set 1-hour snooze when dismissed", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Set needRefresh to true
      mockNeedRefresh = true;
      rerender();
      expect(result.current.needRefresh).toBe(true);

      // Close/snooze the prompt
      act(() => {
        result.current.close();
      });

      // Should hide prompt immediately
      expect(result.current.needRefresh).toBe(false);
    });

    it("should log snooze time when dismissed", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { result } = renderHook(() => useServiceWorkerUpdate());

      act(() => {
        result.current.close();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[SW] Update prompt snoozed for 1 hour")
      );

      consoleSpy.mockRestore();
    });

    it("should re-show prompt after 1-hour snooze expires if update still available", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Set needRefresh to true
      mockNeedRefresh = true;
      rerender();
      expect(result.current.needRefresh).toBe(true);

      // Snooze the update
      act(() => {
        result.current.close();
      });

      expect(result.current.needRefresh).toBe(false);

      // Fast-forward 1 hour
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      // Re-render to trigger effect
      rerender();

      // Update prompt should reappear if update still available (mockNeedRefresh is still true)
      expect(result.current.needRefresh).toBe(true);
    });

    it("should not re-show prompt after snooze if update is no longer available", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Set needRefresh to true
      mockNeedRefresh = true;
      rerender();
      expect(result.current.needRefresh).toBe(true);

      // Snooze the update
      act(() => {
        result.current.close();
      });

      expect(result.current.needRefresh).toBe(false);

      // Update becomes unavailable before snooze expires
      mockNeedRefresh = false;

      // Fast-forward 1 hour
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      // Re-render to trigger effect
      rerender();

      // Update prompt should NOT reappear
      expect(result.current.needRefresh).toBe(false);
    });
  });

  describe("Return Interface", () => {
    it("should return all required methods and properties", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current).toHaveProperty("needRefresh");
      expect(result.current).toHaveProperty("offlineReady");
      expect(result.current).toHaveProperty("updateServiceWorker");
      expect(result.current).toHaveProperty("close");

      expect(typeof result.current.needRefresh).toBe("boolean");
      expect(typeof result.current.offlineReady).toBe("boolean");
      expect(typeof result.current.updateServiceWorker).toBe("function");
      expect(typeof result.current.close).toBe("function");
    });
  });
});
