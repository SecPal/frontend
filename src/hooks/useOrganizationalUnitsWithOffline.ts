// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from "react";
import { listOrganizationalUnits as fetchOrganizationalUnits } from "../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../types/organizational";
import {
  saveOrganizationalUnit,
  listOrganizationalUnits as listCachedOrganizationalUnits,
  clearOrganizationalUnitCache,
} from "../lib/organizationalUnitStore";
import type { OrganizationalUnitCacheEntry } from "../lib/db";
import { useOnlineStatus } from "./useOnlineStatus";

/**
 * Return type for useOrganizationalUnitsWithOffline hook
 */
export interface UseOrganizationalUnitsWithOfflineResult {
  /** Organizational units (from API or cache) */
  units: OrganizationalUnit[];
  /** True while fetching data */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** True if device is offline */
  isOffline: boolean;
  /** True if displaying stale cached data */
  isStale: boolean;
  /** Root unit IDs for tree rendering (permission-filtered roots) */
  rootUnitIds: string[];
  /** Timestamp of last successful sync */
  lastSynced: Date | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

/**
 * Convert OrganizationalUnitCacheEntry to OrganizationalUnit for UI consumption
 */
function cacheEntryToOrganizationalUnit(
  entry: OrganizationalUnitCacheEntry
): OrganizationalUnit {
  return {
    id: entry.id,
    type: entry.type,
    name: entry.name,
    custom_type_name: entry.custom_type_name ?? undefined,
    description: entry.description ?? undefined,
    metadata: entry.metadata,
    parent: entry.parent
      ? {
          id: entry.parent.id,
          type: entry.parent.type as OrganizationalUnit["type"],
          name: entry.parent.name,
          created_at: "",
          updated_at: "",
        }
      : undefined,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

/**
 * Convert OrganizationalUnit to OrganizationalUnitCacheEntry for storage
 */
function organizationalUnitToCacheEntry(
  unit: OrganizationalUnit
): OrganizationalUnitCacheEntry {
  const now = new Date();
  return {
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    description: unit.description ?? undefined,
    metadata: unit.metadata,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: now,
    lastSynced: now,
  };
}

/**
 * Hook for offline-first organizational unit fetching
 *
 * Provides:
 * - Automatic cache fallback when offline or API fails
 * - Online/offline status tracking
 * - Stale data indication
 * - Manual refresh capability
 * - Auto-refresh when coming back online
 *
 * @returns Organizational units with offline status information
 *
 * @example
 * ```tsx
 * function OrganizationList() {
 *   const { units, loading, isOffline, isStale, refresh, rootUnitIds } =
 *     useOrganizationalUnitsWithOffline();
 *
 *   if (loading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {isOffline && <OfflineBanner />}
 *       {isStale && <StaleDataWarning />}
 *       <OrganizationalUnitTree units={units} rootUnitIds={rootUnitIds} />
 *     </>
 *   );
 * }
 * ```
 */
export function useOrganizationalUnitsWithOffline(): UseOrganizationalUnitsWithOfflineResult {
  const [units, setUnits] = useState<OrganizationalUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [rootUnitIds, setRootUnitIds] = useState<string[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const isOnline = useOnlineStatus();

  // Prevent duplicate fetches with ref
  const isFetchingRef = useRef(false);

  // Track previous online state to detect transitions
  const prevOnlineRef = useRef(isOnline);

  /**
   * Load organizational units from IndexedDB cache
   */
  const loadFromCache = useCallback(async (): Promise<OrganizationalUnit[]> => {
    const cached = await listCachedOrganizationalUnits();

    // Find most recent sync time from cached entries
    if (cached.length > 0) {
      const latestSync = Math.max(
        ...cached.map((entry) => entry.lastSynced?.getTime() ?? 0)
      );
      if (latestSync > 0) {
        setLastSynced(new Date(latestSync));
      }
    }

    return cached.map(cacheEntryToOrganizationalUnit);
  }, []);

  /**
   * Fetch organizational units from API and cache them
   */
  const fetchAndCache = useCallback(async (): Promise<{
    units: OrganizationalUnit[];
    rootUnitIds: string[];
  }> => {
    const response = await fetchOrganizationalUnits({ per_page: 100 });

    // Clear cache first to remove units that no longer exist
    await clearOrganizationalUnitCache();

    // Cache all units for offline access
    await Promise.all(
      response.data.map((unit) =>
        saveOrganizationalUnit(organizationalUnitToCacheEntry(unit))
      )
    );

    // Sort by name to match cache sorting (consistent online/offline)
    const sortedUnits = [...response.data].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return {
      units: sortedUnits,
      rootUnitIds: response.meta.root_unit_ids || [],
    };
  }, []);

  /**
   * Fetch organizational units (online or from cache)
   */
  const fetchUnits = useCallback(async () => {
    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      // Use isOnline from hook for consistent online status
      const currentlyOnline = isOnline;

      if (!currentlyOnline) {
        // Offline: use cache only
        const cached = await loadFromCache();
        setUnits(cached);
        setIsStale(cached.length > 0);
        setRootUnitIds([]); // No metadata when offline - will need to infer roots
      } else {
        // Online: try API first
        try {
          const { units: apiUnits, rootUnitIds: apiRootIds } =
            await fetchAndCache();
          setUnits(apiUnits);
          setRootUnitIds(apiRootIds);
          setIsStale(false);
        } catch (apiError) {
          // API failed: fall back to cache
          const cached = await loadFromCache();
          if (cached.length > 0) {
            setUnits(cached);
            setRootUnitIds([]); // No metadata - will need to infer roots
            setIsStale(true);
            // Don't set error - we have cached data
          } else {
            // No cache available
            setUnits([]);
            setRootUnitIds([]);
            const errorMsg =
              apiError instanceof Error ? apiError.message : "Unknown error";
            setError(errorMsg);
          }
        }
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [isOnline, loadFromCache, fetchAndCache]);

  // Initial fetch
  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  // Auto-refresh when coming back online with stale data
  useEffect(() => {
    if (isOnline && isStale && !isFetchingRef.current) {
      fetchUnits();
    }
  }, [isOnline, isStale, fetchUnits]);

  // Detect offline→online transition and mark data as stale
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      // Coming back online - mark data as potentially stale
      setIsStale(true);
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  return {
    units,
    loading,
    error,
    isOffline: !isOnline,
    isStale,
    rootUnitIds,
    lastSynced,
    refresh: fetchUnits,
  };
}
