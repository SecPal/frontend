// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useOrganizationalUnitsWithOffline } from "./useOrganizationalUnitsWithOffline";
import * as organizationalUnitApi from "../services/organizationalUnitApi";
import * as organizationalUnitStore from "../lib/organizationalUnitStore";
import { db } from "../lib/db";
import type { OrganizationalUnitCacheEntry } from "../lib/db";
import type { OrganizationalUnit } from "../types/organizational";

// Mock modules
vi.mock("../services/organizationalUnitApi");
vi.mock("../lib/organizationalUnitStore");

/**
 * Test suite for useOrganizationalUnitsWithOffline hook
 *
 * Tests offline-first data fetching:
 * - Online: Fetch from API, cache results
 * - Offline: Return cached data
 * - Sync status indicators
 * - Error handling
 */
describe("useOrganizationalUnitsWithOffline", () => {
  const mockUnits: OrganizationalUnit[] = [
    {
      id: "unit-1",
      type: "branch",
      name: "Berlin Branch",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-2",
      type: "company",
      name: "SecPal GmbH",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockCachedUnits: OrganizationalUnitCacheEntry[] = [
    {
      id: "unit-1",
      type: "branch",
      name: "Berlin Branch (cached)",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
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
   * Updates navigator.onLine and dispatches the appropriate event
   */
  function setOnlineStatus(isOnline: boolean) {
    Object.defineProperty(navigator, "onLine", {
      value: isOnline,
      writable: true,
      configurable: true,
    });
    // Dispatch the event to trigger useOnlineStatus
    window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
  }

  describe("when online", () => {
    beforeEach(() => {
      setOnlineStatus(true);
    });

    it("should fetch organizational units from API and cache them", async () => {
      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockResolvedValue({
        data: mockUnits,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 2,
          root_unit_ids: ["unit-2"],
        },
      });
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue([]);
      vi.mocked(
        organizationalUnitStore.saveOrganizationalUnit
      ).mockResolvedValue();

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toEqual(mockUnits);
      expect(result.current.rootUnitIds).toEqual(["unit-2"]);
      expect(result.current.isStale).toBe(false);
      expect(result.current.isOffline).toBe(false);
      expect(result.current.error).toBeNull();

      // Should cache all units
      expect(
        organizationalUnitStore.saveOrganizationalUnit
      ).toHaveBeenCalledTimes(2);
    });

    it("should fall back to cache when API fails", async () => {
      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockRejectedValue(new Error("API Error"));
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue(mockCachedUnits);

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toHaveLength(1);
      expect(result.current.units[0].name).toBe("Berlin Branch (cached)");
      expect(result.current.isStale).toBe(true);
      expect(result.current.isOffline).toBe(false);
      expect(result.current.error).toBeNull(); // No error - we have cache
      expect(result.current.rootUnitIds).toEqual([]); // No metadata when offline
    });

    it("should show error when API fails and no cache available", async () => {
      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockRejectedValue(new Error("API Error"));
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue([]);

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toEqual([]);
      expect(result.current.error).toBe("API Error");
      expect(result.current.isStale).toBe(false);
    });
  });

  describe("when offline", () => {
    beforeEach(() => {
      setOnlineStatus(false);
    });

    it("should load organizational units from cache", async () => {
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue(mockCachedUnits);

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toHaveLength(1);
      expect(result.current.units[0].name).toBe("Berlin Branch (cached)");
      expect(result.current.isStale).toBe(true);
      expect(result.current.isOffline).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.rootUnitIds).toEqual([]); // No metadata when offline

      // Should NOT call API
      expect(
        organizationalUnitApi.listOrganizationalUnits
      ).not.toHaveBeenCalled();
    });

    it("should show empty state when no cache available", async () => {
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue([]);

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toEqual([]);
      expect(result.current.isStale).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe("refresh functionality", () => {
    beforeEach(() => {
      setOnlineStatus(true);
    });

    it("should allow manual refresh", async () => {
      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockResolvedValue({
        data: mockUnits,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 2,
          root_unit_ids: ["unit-2"],
        },
      });
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue([]);
      vi.mocked(
        organizationalUnitStore.saveOrganizationalUnit
      ).mockResolvedValue();

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Mock fresh data
      const freshUnits: OrganizationalUnit[] = [
        {
          id: "unit-3",
          type: "region",
          name: "North Region",
          created_at: "2025-01-02T00:00:00Z",
          updated_at: "2025-01-02T00:00:00Z",
        },
      ];

      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockResolvedValue({
        data: freshUnits,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 1,
          root_unit_ids: ["unit-3"],
        },
      });

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.units).toEqual(freshUnits);
      });

      expect(result.current.rootUnitIds).toEqual(["unit-3"]);
    });
  });

  describe("auto-refresh when coming online", () => {
    it("should refresh data when coming back online with stale data", async () => {
      // Start offline with cached data
      setOnlineStatus(false);
      vi.mocked(
        organizationalUnitStore.listOrganizationalUnits
      ).mockResolvedValue(mockCachedUnits);

      const { result } = renderHook(() => useOrganizationalUnitsWithOffline());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.units).toHaveLength(1);
      expect(result.current.isStale).toBe(true);

      // Come back online
      vi.mocked(
        organizationalUnitApi.listOrganizationalUnits
      ).mockResolvedValue({
        data: mockUnits,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 2,
          root_unit_ids: ["unit-2"],
        },
      });
      vi.mocked(
        organizationalUnitStore.saveOrganizationalUnit
      ).mockResolvedValue();

      // Trigger online status change (dispatches event and triggers useEffect)
      act(() => {
        setOnlineStatus(true);
      });

      // Wait for the auto-refresh to complete
      await waitFor(() => {
        expect(result.current.isStale).toBe(false);
      });

      expect(result.current.units).toEqual(mockUnits);
      expect(result.current.rootUnitIds).toEqual(["unit-2"]);
      expect(organizationalUnitApi.listOrganizationalUnits).toHaveBeenCalled();
    });
  });
});
