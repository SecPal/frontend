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
let capturedOnRegisteredSW:
  | ((swUrl: string, registration?: ServiceWorkerRegistration) => void)
  | null = null;
let capturedOnRegisterError: ((error: unknown) => void) | null = null;

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: vi.fn(
    (options?: {
      onRegisteredSW?: (
        swUrl: string,
        registration?: ServiceWorkerRegistration
      ) => void;
      onRegisterError?: (error: unknown) => void;
    }) => {
      // Capture callbacks for testing
      if (options?.onRegisteredSW) {
        capturedOnRegisteredSW = options.onRegisteredSW;
      }
      if (options?.onRegisterError) {
        capturedOnRegisterError = options.onRegisterError;
      }

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
    }
  ),
}));

describe("useServiceWorkerUpdate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockNeedRefresh = false;
    mockOfflineReady = false;
    mockOnNeedRefresh = null;
    mockOnOfflineReady = null;
    capturedOnRegisteredSW = null;
    capturedOnRegisterError = null;
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

    it("should always show update banner when update is available (no dismiss option)", () => {
      const { result, rerender } = renderHook(() => useServiceWorkerUpdate());

      // Update becomes available
      mockNeedRefresh = true;
      rerender();

      // Banner should be visible
      expect(result.current.needRefresh).toBe(true);

      // Wait any amount of time - banner should still be visible
      act(() => {
        vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 24 hours
      });
      rerender();

      // Banner should still be visible until user updates
      expect(result.current.needRefresh).toBe(true);
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
        "[SW Hook] Update failed:",
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Return Interface", () => {
    it("should return all required methods and properties", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current).toHaveProperty("needRefresh");
      expect(result.current).toHaveProperty("offlineReady");
      expect(result.current).toHaveProperty("updateServiceWorker");

      expect(typeof result.current.needRefresh).toBe("boolean");
      expect(typeof result.current.offlineReady).toBe("boolean");
      expect(typeof result.current.updateServiceWorker).toBe("function");
    });

    it("should not have a close function (banner is non-dismissible)", () => {
      const { result } = renderHook(() => useServiceWorkerUpdate());

      expect(result.current).not.toHaveProperty("close");
    });
  });

  describe("Service Worker Registration Callbacks", () => {
    it("should log when service worker is registered", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      renderHook(() => useServiceWorkerUpdate());

      // Simulate SW registration callback
      if (capturedOnRegisteredSW) {
        capturedOnRegisteredSW("https://example.com/sw.js");
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "[SW] Service Worker registered: https://example.com/sw.js"
      );

      consoleSpy.mockRestore();
    });

    it("should set up periodic update checks when registration is provided", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const mockRegistration = {
        update: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      renderHook(() => useServiceWorkerUpdate());

      // Simulate SW registration callback with registration object
      if (capturedOnRegisteredSW) {
        capturedOnRegisteredSW("https://example.com/sw.js", mockRegistration);
      }

      // Should set up interval for periodic checks
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        60 * 60 * 1000 // 1 hour
      );

      setIntervalSpy.mockRestore();
    });

    it("should check for updates when periodic interval fires", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const mockRegistration = {
        update: vi.fn(),
      } as unknown as ServiceWorkerRegistration;

      renderHook(() => useServiceWorkerUpdate());

      // Simulate SW registration callback
      if (capturedOnRegisteredSW) {
        capturedOnRegisteredSW("https://example.com/sw.js", mockRegistration);
      }

      // Fast-forward 1 hour to trigger periodic check
      act(() => {
        vi.advanceTimersByTime(60 * 60 * 1000);
      });

      expect(consoleSpy).toHaveBeenCalledWith("[SW] Checking for updates...");
      expect(mockRegistration.update).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should log registration errors", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      renderHook(() => useServiceWorkerUpdate());

      // Simulate registration error callback
      const testError = new Error("Registration failed");
      if (capturedOnRegisterError) {
        capturedOnRegisterError(testError);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[SW] Registration failed:",
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
