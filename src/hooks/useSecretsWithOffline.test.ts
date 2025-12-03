// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSecretsWithOffline } from "./useSecretsWithOffline";
import * as secretApi from "../services/secretApi";
import * as secretStore from "../lib/secretStore";
import { db } from "../lib/db";
import type { SecretCacheEntry } from "../lib/db";
import type { Secret } from "../services/secretApi";

// Mock modules
vi.mock("../services/secretApi");
vi.mock("../lib/secretStore");

/**
 * Test suite for useSecretsWithOffline hook
 *
 * Tests offline-first data fetching:
 * - Online: Fetch from API, cache results
 * - Offline: Return cached data
 * - Sync status indicators
 * - Error handling
 */
describe("useSecretsWithOffline", () => {
  const mockSecrets: Secret[] = [
    {
      id: "secret-1",
      title: "Gmail Account",
      username: "user@example.com",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-15T00:00:00Z",
      tags: ["email"],
    },
    {
      id: "secret-2",
      title: "GitHub Token",
      username: "devuser",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-16T00:00:00Z",
      tags: ["dev"],
    },
  ];

  const mockCachedSecrets: SecretCacheEntry[] = [
    {
      id: "secret-1",
      title: "Gmail Account (cached)",
      username: "user@example.com",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-10T00:00:00Z",
      tags: ["email"],
      cachedAt: new Date("2025-01-10T00:00:00Z"),
      lastSynced: new Date("2025-01-10T00:00:00Z"),
    },
  ];

  // Store original navigator.onLine
  let originalOnLine: boolean;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Store original value
    originalOnLine = navigator.onLine;

    // Clear IndexedDB
    await db.delete();
    await db.open();
  });

  afterEach(() => {
    // Restore navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Helper to set online status
   */
  function setOnlineStatus(isOnline: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value: isOnline,
      writable: true,
      configurable: true,
    });
  }

  describe("when online", () => {
    beforeEach(() => {
      setOnlineStatus(true);
    });

    it("should fetch secrets from API and cache them", async () => {
      vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
      vi.mocked(secretStore.listSecrets).mockResolvedValue([]);
      vi.mocked(secretStore.saveSecret).mockResolvedValue();

      const { result } = renderHook(() => useSecretsWithOffline());

      // Initial state
      expect(result.current.loading).toBe(true);
      expect(result.current.secrets).toEqual([]);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have fetched secrets
      expect(secretApi.fetchSecrets).toHaveBeenCalledTimes(1);
      expect(result.current.secrets).toHaveLength(2);
      expect(result.current.secrets[0]?.title).toBe("Gmail Account");

      // Should have cached secrets
      expect(secretStore.saveSecret).toHaveBeenCalledTimes(2);

      // Should show online status
      expect(result.current.isOffline).toBe(false);
      expect(result.current.isStale).toBe(false);
    });

    it("should fall back to cache on API error", async () => {
      vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
        new Error("Network error")
      );
      vi.mocked(secretStore.listSecrets).mockResolvedValue(mockCachedSecrets);

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return cached data
      expect(result.current.secrets).toHaveLength(1);
      expect(result.current.secrets[0]?.title).toBe("Gmail Account (cached)");

      // Should indicate stale data
      expect(result.current.isStale).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should show error when API fails and no cache available", async () => {
      vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
        new Error("Network error")
      );
      vi.mocked(secretStore.listSecrets).mockResolvedValue([]);

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should show error
      expect(result.current.secrets).toEqual([]);
      expect(result.current.error).toBe("Network error");
    });
  });

  describe("when offline", () => {
    beforeEach(() => {
      setOnlineStatus(false);
    });

    it("should return cached secrets without API call", async () => {
      vi.mocked(secretStore.listSecrets).mockResolvedValue(mockCachedSecrets);

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should NOT call API when offline
      expect(secretApi.fetchSecrets).not.toHaveBeenCalled();

      // Should return cached secrets
      expect(result.current.secrets).toHaveLength(1);
      expect(result.current.secrets[0]?.title).toBe("Gmail Account (cached)");

      // Should indicate offline status
      expect(result.current.isOffline).toBe(true);
      expect(result.current.isStale).toBe(true);
    });

    it("should show empty state when offline with no cache", async () => {
      vi.mocked(secretStore.listSecrets).mockResolvedValue([]);

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.secrets).toEqual([]);
      expect(result.current.isOffline).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe("online/offline transitions", () => {
    it("should refetch when coming back online", async () => {
      setOnlineStatus(false);
      vi.mocked(secretStore.listSecrets).mockResolvedValue(mockCachedSecrets);
      vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
      vi.mocked(secretStore.saveSecret).mockResolvedValue();

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should be offline with cached data
      expect(result.current.isOffline).toBe(true);
      expect(result.current.secrets).toHaveLength(1);

      // Simulate coming back online
      act(() => {
        setOnlineStatus(true);
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(result.current.isOffline).toBe(false);
      });

      // Should have refetched from API
      expect(secretApi.fetchSecrets).toHaveBeenCalled();
    });
  });

  describe("refresh functionality", () => {
    it("should expose refresh function", async () => {
      setOnlineStatus(true);
      vi.mocked(secretApi.fetchSecrets).mockResolvedValue(mockSecrets);
      vi.mocked(secretStore.listSecrets).mockResolvedValue([]);
      vi.mocked(secretStore.saveSecret).mockResolvedValue();

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(secretApi.fetchSecrets).toHaveBeenCalledTimes(1);

      // Trigger manual refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(secretApi.fetchSecrets).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache timestamp", () => {
    it("should expose lastSynced timestamp", async () => {
      const syncTime = new Date("2025-01-15T12:00:00Z");
      const baseSecret = mockCachedSecrets[0];
      if (!baseSecret) {
        throw new Error("Mock data setup error");
      }
      const cachedWithTime: SecretCacheEntry[] = [
        {
          ...baseSecret,
          lastSynced: syncTime,
        },
      ];

      setOnlineStatus(false);
      vi.mocked(secretStore.listSecrets).mockResolvedValue(cachedWithTime);

      const { result } = renderHook(() => useSecretsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.lastSynced).toEqual(syncTime);
    });
  });
});
