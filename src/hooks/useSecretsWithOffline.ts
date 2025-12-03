// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback } from "react";
import { fetchSecrets, type Secret } from "../services/secretApi";
import {
  saveSecret,
  listSecrets as listCachedSecrets,
} from "../lib/secretStore";
import type { SecretCacheEntry } from "../lib/db";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * Return type for useSecretsWithOffline hook
 */
export interface UseSecretsWithOfflineResult {
  /** List of secrets (from API or cache) */
  secrets: Secret[];
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** True when device is offline */
  isOffline: boolean;
  /** True when showing cached data (not fresh from API) */
  isStale: boolean;
  /** Timestamp of last successful sync */
  lastSynced: Date | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
}

/**
 * Convert SecretCacheEntry to Secret for UI consumption
 */
function cacheEntryToSecret(entry: SecretCacheEntry): Secret {
  return {
    id: entry.id,
    title: entry.title,
    username: entry.username,
    url: entry.url,
    notes: entry.notes,
    tags: entry.tags,
    expires_at: entry.expires_at,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    attachment_count: entry.attachment_count,
    is_shared: entry.is_shared,
  };
}

/**
 * Convert Secret to SecretCacheEntry for storage
 */
function secretToCacheEntry(secret: Secret): SecretCacheEntry {
  const now = new Date();
  return {
    id: secret.id,
    title: secret.title,
    username: secret.username,
    url: secret.url,
    notes: secret.notes,
    tags: secret.tags,
    expires_at: secret.expires_at,
    created_at: secret.created_at,
    updated_at: secret.updated_at,
    attachment_count: secret.attachment_count,
    is_shared: secret.is_shared,
    cachedAt: now,
    lastSynced: now,
  };
}

/**
 * Hook for offline-first secret fetching
 *
 * Provides:
 * - Automatic cache fallback when offline or API fails
 * - Online/offline status tracking
 * - Stale data indication
 * - Manual refresh capability
 * - Auto-refresh when coming back online
 *
 * @returns Secrets with offline status information
 *
 * @example
 * ```tsx
 * function SecretList() {
 *   const { secrets, loading, isOffline, isStale, refresh } = useSecretsWithOffline();
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isOffline && <OfflineBanner />}
 *       {isStale && <StaleDataWarning />}
 *       <SecretGrid secrets={secrets} />
 *     </>
 *   );
 * }
 * ```
 */
export function useSecretsWithOffline(): UseSecretsWithOfflineResult {
  const isOnline = useOnlineStatus();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  /**
   * Load secrets from cache
   */
  const loadFromCache = useCallback(async (): Promise<Secret[]> => {
    const cached = await listCachedSecrets();
    if (cached.length > 0) {
      // Find most recent sync time
      const latestSync = cached.reduce((latest, entry) => {
        const syncTime = entry.lastSynced?.getTime() ?? 0;
        return syncTime > latest ? syncTime : latest;
      }, 0);
      if (latestSync > 0) {
        setLastSynced(new Date(latestSync));
      }
    }
    return cached.map(cacheEntryToSecret);
  }, []);

  /**
   * Cache secrets to IndexedDB
   */
  const cacheSecrets = useCallback(async (secretsToCache: Secret[]) => {
    for (const secret of secretsToCache) {
      await saveSecret(secretToCacheEntry(secret));
    }
  }, []);

  /**
   * Fetch secrets from API and cache them
   */
  const fetchAndCache = useCallback(async (): Promise<Secret[]> => {
    const apiSecrets = await fetchSecrets();
    await cacheSecrets(apiSecrets);
    setLastSynced(new Date());
    return apiSecrets;
  }, [cacheSecrets]);

  /**
   * Load secrets with offline fallback
   */
  const loadSecrets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isOnline) {
        // Offline: use cache only
        const cached = await loadFromCache();
        setSecrets(cached);
        setIsStale(cached.length > 0);
      } else {
        // Online: try API first
        try {
          const apiSecrets = await fetchAndCache();
          setSecrets(apiSecrets);
          setIsStale(false);
        } catch (apiError) {
          // API failed: fall back to cache
          const cached = await loadFromCache();
          if (cached.length > 0) {
            setSecrets(cached);
            setIsStale(true);
            // Don't set error - we have cached data
          } else {
            // No cache available
            setSecrets([]);
            const errorMsg =
              apiError instanceof Error ? apiError.message : "Unknown error";
            setError(errorMsg);
          }
        }
      }
    } catch (cacheError) {
      // Cache read failed (rare)
      const errorMsg =
        cacheError instanceof Error
          ? cacheError.message
          : "Failed to load secrets";
      setError(errorMsg);
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }, [isOnline, fetchAndCache, loadFromCache]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await loadSecrets();
  }, [loadSecrets]);

  // Initial load
  useEffect(() => {
    loadSecrets();
  }, [loadSecrets]);

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && isStale) {
      loadSecrets();
    }
  }, [isOnline, isStale, loadSecrets]);

  return {
    secrets,
    loading,
    error,
    isOffline: !isOnline,
    isStale,
    lastSynced,
    refresh,
  };
}
