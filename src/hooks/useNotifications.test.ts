// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotifications } from "./useNotifications";

// Mock Notification API
const mockNotification = vi.fn();
const mockServiceWorkerRegistration = {
  showNotification: vi.fn().mockResolvedValue(undefined),
};

describe("useNotifications", () => {
  beforeEach(() => {
    // Setup Notification mock
    globalThis.Notification = mockNotification as never;
    Object.defineProperty(globalThis.Notification, "permission", {
      writable: true,
      value: "default",
    });
    globalThis.Notification.requestPermission = vi
      .fn()
      .mockResolvedValue("granted");

    // Setup Service Worker mock
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve(mockServiceWorkerRegistration),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.permission).toBe("default");
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should detect unsupported browsers", () => {
      // Remove Notification from window
      const originalNotification = globalThis.Notification;
      // @ts-expect-error - intentionally testing unsupported environment
      delete globalThis.Notification;

      const { result } = renderHook(() => useNotifications());

      expect(result.current.isSupported).toBe(false);

      // Restore
      globalThis.Notification = originalNotification;
    });
  });

  describe("requestPermission", () => {
    it("should request and update permission state", async () => {
      const { result } = renderHook(() => useNotifications());

      let permissionResult: string | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe("granted");
      expect(result.current.permission).toBe("granted");
      expect(globalThis.Notification.requestPermission).toHaveBeenCalledOnce();
    });

    it("should handle denied permission", async () => {
      globalThis.Notification.requestPermission = vi
        .fn()
        .mockResolvedValue("denied");

      const { result } = renderHook(() => useNotifications());

      let permissionResult: string | undefined;
      await act(async () => {
        permissionResult = await result.current.requestPermission();
      });

      expect(permissionResult).toBe("denied");
      expect(result.current.permission).toBe("denied");
    });

    it("should throw error if notifications not supported", async () => {
      // Remove Notification from window
      const originalNotification = globalThis.Notification;
      // @ts-expect-error - intentionally testing unsupported environment
      delete globalThis.Notification;

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(result.current.requestPermission()).rejects.toThrow(
          "Notifications are not supported"
        );
      });

      // Restore
      globalThis.Notification = originalNotification;
    });

    it("should handle permission request errors", async () => {
      const testError = new Error("Permission request failed");
      globalThis.Notification.requestPermission = vi
        .fn()
        .mockRejectedValue(testError);

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(result.current.requestPermission()).rejects.toThrow(
          testError
        );
      });

      expect(result.current.error).toBe(testError);
    });
  });

  describe("showNotification", () => {
    beforeEach(() => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      });
    });

    it("should show notification via service worker", async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Test Notification",
          body: "This is a test",
        });
      });

      expect(
        mockServiceWorkerRegistration.showNotification
      ).toHaveBeenCalledWith(
        "Test Notification",
        expect.objectContaining({
          body: "This is a test",
          icon: "/pwa-192x192.svg",
          badge: "/pwa-192x192.svg",
        })
      );
    });

    it("should include custom options", async () => {
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Custom Notification",
          body: "With options",
          icon: "/custom-icon.png",
          tag: "custom-tag",
          requireInteraction: true,
          data: { id: 123 },
        });
      });

      expect(
        mockServiceWorkerRegistration.showNotification
      ).toHaveBeenCalledWith(
        "Custom Notification",
        expect.objectContaining({
          body: "With options",
          icon: "/custom-icon.png",
          tag: "custom-tag",
          requireInteraction: true,
          data: { id: 123 },
        })
      );
    });

    it("should throw error if permission not granted", async () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "denied",
      });
      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(
          result.current.showNotification({
            title: "Test",
            body: "Should fail",
          })
        ).rejects.toThrow("Notification permission not granted");
      });
    });

    it("should fallback to browser notification if service worker unavailable", async () => {
      // Mock service worker without showNotification
      Object.defineProperty(navigator, "serviceWorker", {
        value: {
          ready: Promise.resolve({}),
        },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: "Fallback Notification",
          body: "Using browser API",
        });
      });

      expect(mockNotification).toHaveBeenCalledWith("Fallback Notification", {
        body: "Using browser API",
        icon: "/pwa-192x192.svg",
        tag: undefined,
        requireInteraction: undefined,
        data: undefined,
      });
    });

    it("should handle notification errors", async () => {
      const testError = new Error("Notification failed");
      mockServiceWorkerRegistration.showNotification.mockRejectedValueOnce(
        testError
      );

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await expect(
          result.current.showNotification({
            title: "Test",
            body: "Should fail",
          })
        ).rejects.toThrow(testError);
      });

      await waitFor(() => {
        expect(result.current.error).toBe(testError);
      });
    });
  });

  describe("loading states", () => {
    it("should set loading state during permission request", async () => {
      let resolvePermission: (value: string) => void;
      const permissionPromise = new Promise<string>((resolve) => {
        resolvePermission = resolve;
      });

      globalThis.Notification.requestPermission = vi
        .fn()
        .mockReturnValue(permissionPromise);

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.requestPermission();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolvePermission!("granted");
        await permissionPromise;
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it("should set loading state during notification display", async () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        writable: true,
        value: "granted",
      }); // Ensure permission is granted

      mockServiceWorkerRegistration.showNotification.mockResolvedValueOnce(
        undefined
      );

      const { result } = renderHook(() => useNotifications());

      // Notification should complete successfully
      await act(async () => {
        await result.current.showNotification({
          title: "Test",
          body: "Loading test",
        });
      });

      // After completion, loading should be false
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
