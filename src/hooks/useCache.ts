// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useCallback } from "react";

/**
 * Cache invalidation and management hook
 *
 * Provides utilities to manually invalidate caches after mutations,
 * clear all caches, and query cache status.
 *
 * @example
 * ```tsx
 * const { invalidateCache, clearAllCaches } = useCache();
 *
 * // After creating a secret
 * await invalidateCache(['api-secrets']);
 *
 * // Clear all caches on logout
 * await clearAllCaches();
 * ```
 */
export const useCache = () => {
  /**
   * Invalidate specific cache by name
   *
   * @param cacheNames - Array of cache names to delete
   * @returns Promise that resolves when caches are deleted
   */
  const invalidateCache = useCallback(async (cacheNames: string[]) => {
    if (!("caches" in window)) {
      console.warn("Cache API not supported");
      return;
    }

    try {
      for (const name of cacheNames) {
        const deleted = await caches.delete(name);
        if (deleted) {
          console.log(`[Cache] Invalidated cache: ${name}`);
        }
      }
    } catch (error) {
      console.error("[Cache] Failed to invalidate caches:", error);
      throw error;
    }
  }, []);

  /**
   * Clear all application caches
   *
   * Useful for logout, app reset, or debugging
   *
   * @returns Promise that resolves when all caches are cleared
   */
  const clearAllCaches = useCallback(async () => {
    if (!("caches" in window)) {
      console.warn("Cache API not supported");
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      console.log(`[Cache] Cleared ${cacheNames.length} caches`);
    } catch (error) {
      console.error("[Cache] Failed to clear all caches:", error);
      throw error;
    }
  }, []);

  /**
   * Get cache storage usage information
   *
   * @returns Promise that resolves to storage estimate
   */
  const getCacheSize = useCallback(async () => {
    if (!("caches" in window) || !("storage" in navigator)) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
        usagePercent: estimate.quota
          ? ((estimate.usage ?? 0) / estimate.quota) * 100
          : 0,
      };
    } catch (error) {
      console.error("[Cache] Failed to get cache size:", error);
      return null;
    }
  }, []);

  /**
   * Check if a specific URL is cached
   *
   * @param url - URL to check
   * @param cacheName - Optional cache name to check (checks all if omitted)
   * @returns Promise that resolves to boolean
   */
  const isCached = useCallback(
    async (url: string, cacheName?: string): Promise<boolean> => {
      if (!("caches" in window)) {
        return false;
      }

      try {
        if (cacheName) {
          const cache = await caches.open(cacheName);
          const response = await cache.match(url);
          return !!response;
        }

        const response = await caches.match(url);
        return !!response;
      } catch (error) {
        console.error("[Cache] Failed to check cache status:", error);
        return false;
      }
    },
    []
  );

  return {
    invalidateCache,
    clearAllCaches,
    getCacheSize,
    isCached,
  };
};
