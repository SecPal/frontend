// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePushSubscription } from "./usePushSubscription";

const TEST_VAPID_KEY = "BNxpMrN9pqQe9bKs0123456789abcdefghijklmnopqrstuvwxyz";

// Mock Service Worker and Push Manager
const mockPushManager = {
  subscribe: vi.fn(),
  getSubscription: vi.fn(),
};

const mockServiceWorkerRegistration = {
  pushManager: mockPushManager,
};

const mockSubscription = {
  endpoint: "https://push.service.com/endpoint",
  toJSON: vi.fn().mockReturnValue({
    endpoint: "https://push.service.com/endpoint",
    keys: {
      p256dh: "mock-p256dh-key",
      auth: "mock-auth-key",
    },
  }),
  unsubscribe: vi.fn().mockResolvedValue(true),
};

describe("usePushSubscription", () => {
  beforeEach(() => {
    // Setup Service Worker mock
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ready: Promise.resolve(mockServiceWorkerRegistration),
      },
      writable: true,
      configurable: true,
    });

    // Setup PushManager mock
    Object.defineProperty(window, "PushManager", {
      value: function PushManager() {},
      writable: true,
      configurable: true,
    });

    // Reset mocks
    mockPushManager.subscribe.mockResolvedValue(mockSubscription);
    mockPushManager.getSubscription.mockResolvedValue(null);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with correct default values", () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      expect(result.current.subscription).toBeNull();
      expect(result.current.isSubscribed).toBe(false);
      expect(result.current.isSupported).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("should detect unsupported browsers (no serviceWorker)", () => {
      // Remove serviceWorker from navigator
      const originalSW = Object.getOwnPropertyDescriptor(
        navigator,
        "serviceWorker"
      );
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      expect(result.current.isSupported).toBe(false);

      // Restore
      if (originalSW) {
        Object.defineProperty(navigator, "serviceWorker", originalSW);
      }
    });

    it("should load existing subscription on mount", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await vi.waitFor(() => {
        expect(result.current.subscription).toBe(mockSubscription);
        expect(result.current.isSubscribed).toBe(true);
      });
    });
  });

  describe("subscribe", () => {
    it("should subscribe to push notifications", async () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      let subscription = null;
      await act(async () => {
        subscription = await result.current.subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });
      expect(subscription).toBe(mockSubscription);
      expect(result.current.isSubscribed).toBe(true);
    });

    it("should use provided VAPID public key", async () => {
      const customVapidKey = "custom-vapid-key-base64";
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: customVapidKey })
      );

      await act(async () => {
        await result.current.subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      });
    });

    it("should throw error if already subscribed", async () => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await vi.waitFor(() => {
        expect(result.current.isSubscribed).toBe(true);
      });

      await act(async () => {
        await expect(result.current.subscribe()).rejects.toThrow(
          "Already subscribed"
        );
      });
    });

    it("should throw error if not supported", async () => {
      // Remove serviceWorker from navigator
      const originalSW = Object.getOwnPropertyDescriptor(
        navigator,
        "serviceWorker"
      );
      Object.defineProperty(navigator, "serviceWorker", {
        value: undefined,
        configurable: true,
      });

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      expect(result.current.isSupported).toBe(false);

      await act(async () => {
        await expect(result.current.subscribe()).rejects.toThrow(
          "Push notifications are not supported"
        );
      });

      // Restore
      if (originalSW) {
        Object.defineProperty(navigator, "serviceWorker", originalSW);
      }
    });

    it("should handle subscription errors", async () => {
      const testError = new Error("Subscription failed");
      mockPushManager.subscribe.mockRejectedValue(testError);

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await act(async () => {
        await expect(result.current.subscribe()).rejects.toThrow(testError);
      });

      expect(result.current.error).toBe(testError);
    });
  });

  describe("unsubscribe", () => {
    beforeEach(() => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
    });

    it("should unsubscribe from push notifications", async () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await vi.waitFor(() => {
        expect(result.current.isSubscribed).toBe(true);
      });

      await act(async () => {
        await result.current.unsubscribe();
      });

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
      expect(result.current.subscription).toBeNull();
      expect(result.current.isSubscribed).toBe(false);
    });

    it("should throw error if not subscribed", async () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await act(async () => {
        await expect(result.current.unsubscribe()).rejects.toThrow(
          "Not subscribed"
        );
      });
    });

    it("should handle unsubscribe errors", async () => {
      const testError = new Error("Unsubscribe failed");
      mockSubscription.unsubscribe.mockRejectedValue(testError);

      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await vi.waitFor(() => {
        expect(result.current.isSubscribed).toBe(true);
      });

      await act(async () => {
        await expect(result.current.unsubscribe()).rejects.toThrow(testError);
      });

      expect(result.current.error).toBe(testError);
    });
  });

  describe("getSubscriptionData", () => {
    beforeEach(() => {
      mockPushManager.getSubscription.mockResolvedValue(mockSubscription);
    });

    it("should return subscription data in correct format", async () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      await vi.waitFor(() => {
        expect(result.current.isSubscribed).toBe(true);
      });

      const data = result.current.getSubscriptionData();

      expect(data).toEqual({
        endpoint: "https://push.service.com/endpoint",
        keys: {
          p256dh: "mock-p256dh-key",
          auth: "mock-auth-key",
        },
      });
    });

    it("should return null if not subscribed", () => {
      const { result } = renderHook(() =>
        usePushSubscription({ vapidPublicKey: TEST_VAPID_KEY })
      );

      const data = result.current.getSubscriptionData();

      expect(data).toBeNull();
    });
  });
});
