// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCache } from "./useCache";

// Mock Cache API
const mockCaches = {
  keys: vi.fn(),
  delete: vi.fn(),
  open: vi.fn(),
  match: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // @ts-expect-error - Mocking global caches
  global.caches = mockCaches;
  // @ts-expect-error - Mocking global navigator.storage
  global.navigator.storage = {
    estimate: vi.fn(),
  };
});

describe("useCache", () => {
  describe("invalidateCache", () => {
    it("should delete specified caches", async () => {
      mockCaches.delete.mockResolvedValue(true);

      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.invalidateCache(["api-secrets", "api-users"]);
      });

      expect(mockCaches.delete).toHaveBeenCalledWith("api-secrets");
      expect(mockCaches.delete).toHaveBeenCalledWith("api-users");
      expect(mockCaches.delete).toHaveBeenCalledTimes(2);
    });

    it("should handle errors gracefully", async () => {
      mockCaches.delete.mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() => useCache());

      await expect(
        result.current.invalidateCache(["api-secrets"])
      ).rejects.toThrow("Delete failed");
    });

    it("should warn if Cache API not supported", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      // @ts-expect-error - Removing caches to simulate unsupported browser
      delete global.caches;

      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.invalidateCache(["api-secrets"]);
      });

      expect(consoleSpy).toHaveBeenCalledWith("Cache API not supported");
      consoleSpy.mockRestore();
    });
  });

  describe("clearAllCaches", () => {
    it("should delete all caches", async () => {
      mockCaches.keys.mockResolvedValue(["cache-1", "cache-2", "cache-3"]);
      mockCaches.delete.mockResolvedValue(true);

      const { result } = renderHook(() => useCache());

      await act(async () => {
        await result.current.clearAllCaches();
      });

      expect(mockCaches.keys).toHaveBeenCalled();
      expect(mockCaches.delete).toHaveBeenCalledTimes(3);
      expect(mockCaches.delete).toHaveBeenCalledWith("cache-1");
      expect(mockCaches.delete).toHaveBeenCalledWith("cache-2");
      expect(mockCaches.delete).toHaveBeenCalledWith("cache-3");
    });
  });

  describe("getCacheSize", () => {
    it("should return storage estimate", async () => {
      const mockEstimate = {
        usage: 1024 * 1024 * 10, // 10MB
        quota: 1024 * 1024 * 100, // 100MB
      };
      // @ts-expect-error - Mock storage.estimate
      navigator.storage.estimate.mockResolvedValue(mockEstimate);

      const { result } = renderHook(() => useCache());

      let size;
      await act(async () => {
        size = await result.current.getCacheSize();
      });

      expect(size).toEqual({
        usage: 10485760,
        quota: 104857600,
        usagePercent: 10,
      });
    });

    it("should return null if storage API not supported", async () => {
      // @ts-expect-error - Removing storage to simulate unsupported browser
      delete global.navigator.storage;

      const { result } = renderHook(() => useCache());

      let size;
      await act(async () => {
        size = await result.current.getCacheSize();
      });

      expect(size).toBeNull();
    });
  });

  describe("isCached", () => {
    it("should check if URL is cached in specific cache", async () => {
      const mockCache = {
        match: vi.fn().mockResolvedValue(new Response()),
      };
      mockCaches.open.mockResolvedValue(mockCache);

      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.isCached(
          "/api/v1/secrets",
          "api-secrets"
        );
      });

      expect(cached).toBe(true);
      expect(mockCaches.open).toHaveBeenCalledWith("api-secrets");
      expect(mockCache.match).toHaveBeenCalledWith("/api/v1/secrets");
    });

    it("should check if URL is cached in any cache", async () => {
      mockCaches.match.mockResolvedValue(new Response());

      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.isCached("/api/v1/secrets");
      });

      expect(cached).toBe(true);
      expect(mockCaches.match).toHaveBeenCalledWith("/api/v1/secrets");
    });

    it("should return false if URL not cached", async () => {
      mockCaches.match.mockResolvedValue(undefined);

      const { result } = renderHook(() => useCache());

      let cached;
      await act(async () => {
        cached = await result.current.isCached("/api/v1/secrets");
      });

      expect(cached).toBe(false);
    });
  });
});
