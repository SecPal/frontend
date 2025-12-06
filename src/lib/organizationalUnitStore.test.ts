// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import type { OrganizationalUnitCacheEntry } from "./db";
import {
  saveOrganizationalUnit,
  getOrganizationalUnit,
  listOrganizationalUnits,
  deleteOrganizationalUnit,
  getOrganizationalUnitsByType,
  getOrganizationalUnitsByParent,
  searchOrganizationalUnits,
  clearOrganizationalUnitCache,
  getPendingSyncUnits,
} from "./organizationalUnitStore";

/**
 * Test suite for OrganizationalUnitStore (IndexedDB organizational unit caching)
 *
 * Tests offline-first organizational unit management:
 * - CRUD operations (save, get, list, delete)
 * - Filtering (type, parent, search)
 * - Cache management
 */
describe("OrganizationalUnitStore", () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.delete();
    await db.open();
  });

  describe("saveOrganizationalUnit", () => {
    it("should save an organizational unit to IndexedDB", async () => {
      const unit: OrganizationalUnitCacheEntry = {
        id: "unit-1",
        type: "branch",
        name: "Berlin Branch",
        description: "Main branch in Berlin",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      };

      await saveOrganizationalUnit(unit);

      const saved = await db.organizationalUnitCache.get("unit-1");
      expect(saved).toBeDefined();
      expect(saved?.name).toBe("Berlin Branch");
      expect(saved?.type).toBe("branch");
    });

    it("should update an existing organizational unit", async () => {
      const unit: OrganizationalUnitCacheEntry = {
        id: "unit-1",
        type: "branch",
        name: "Berlin Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      };

      await saveOrganizationalUnit(unit);

      // Update
      const updated: OrganizationalUnitCacheEntry = {
        ...unit,
        name: "Berlin Branch (Updated)",
        updated_at: "2025-01-11T00:00:00Z",
      };

      await saveOrganizationalUnit(updated);

      const saved = await db.organizationalUnitCache.get("unit-1");
      expect(saved?.name).toBe("Berlin Branch (Updated)");
      expect(saved?.updated_at).toBe("2025-01-11T00:00:00Z");

      // Should still have only one entry
      const allUnits = await db.organizationalUnitCache.toArray();
      expect(allUnits).toHaveLength(1);
    });
  });

  describe("getOrganizationalUnit", () => {
    it("should retrieve an organizational unit by ID", async () => {
      const unit: OrganizationalUnitCacheEntry = {
        id: "unit-1",
        type: "branch",
        name: "Berlin Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      };

      await db.organizationalUnitCache.put(unit);

      const retrieved = await getOrganizationalUnit("unit-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("Berlin Branch");
    });

    it("should return undefined for non-existent unit", async () => {
      const retrieved = await getOrganizationalUnit("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("listOrganizationalUnits", () => {
    it("should list all organizational units sorted by name", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Zebra Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "company",
          name: "Alpha Company",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-3",
          type: "region",
          name: "Beta Region",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const retrieved = await listOrganizationalUnits();
      expect(retrieved).toHaveLength(3);
      // Should be sorted by name alphabetically
      expect(retrieved[0].name).toBe("Alpha Company");
      expect(retrieved[1].name).toBe("Beta Region");
      expect(retrieved[2].name).toBe("Zebra Branch");
    });

    it("should return empty array when no units cached", async () => {
      const retrieved = await listOrganizationalUnits();
      expect(retrieved).toEqual([]);
    });
  });

  describe("deleteOrganizationalUnit", () => {
    it("should delete an organizational unit from cache", async () => {
      const unit: OrganizationalUnitCacheEntry = {
        id: "unit-1",
        type: "branch",
        name: "Berlin Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      };

      await db.organizationalUnitCache.put(unit);
      expect(await db.organizationalUnitCache.get("unit-1")).toBeDefined();

      await deleteOrganizationalUnit("unit-1");
      expect(await db.organizationalUnitCache.get("unit-1")).toBeUndefined();
    });

    it("should not throw error when deleting non-existent unit", async () => {
      await expect(
        deleteOrganizationalUnit("non-existent")
      ).resolves.toBeUndefined();
    });
  });

  describe("getOrganizationalUnitsByType", () => {
    it("should filter units by type", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Berlin Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "branch",
          name: "Hamburg Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-3",
          type: "company",
          name: "SecPal GmbH",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const branches = await getOrganizationalUnitsByType("branch");
      expect(branches).toHaveLength(2);
      expect(branches[0].name).toBe("Berlin Branch");
      expect(branches[1].name).toBe("Hamburg Branch");

      const companies = await getOrganizationalUnitsByType("company");
      expect(companies).toHaveLength(1);
      expect(companies[0].name).toBe("SecPal GmbH");
    });

    it("should return empty array when no units match type", async () => {
      const units = await getOrganizationalUnitsByType("holding");
      expect(units).toEqual([]);
    });
  });

  describe("getOrganizationalUnitsByParent", () => {
    it("should filter units by parent ID", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Berlin Branch",
          parent_id: "company-1",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "branch",
          name: "Hamburg Branch",
          parent_id: "company-1",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-3",
          type: "branch",
          name: "Munich Branch",
          parent_id: "company-2",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const children = await getOrganizationalUnitsByParent("company-1");
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe("Berlin Branch");
      expect(children[1].name).toBe("Hamburg Branch");
    });

    it("should return root units when parentId is null", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "holding",
          name: "Root Holding",
          parent_id: null,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "branch",
          name: "Child Branch",
          parent_id: "unit-1",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const rootUnits = await getOrganizationalUnitsByParent(null);
      expect(rootUnits).toHaveLength(1);
      expect(rootUnits[0].name).toBe("Root Holding");
    });
  });

  describe("searchOrganizationalUnits", () => {
    it("should search units by name (case-insensitive)", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Berlin Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "branch",
          name: "Hamburg Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-3",
          type: "company",
          name: "Berlin Company",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const results = await searchOrganizationalUnits("berlin");
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("Berlin Branch");
      expect(results[1].name).toBe("Berlin Company");

      const upperResults = await searchOrganizationalUnits("BRANCH");
      expect(upperResults).toHaveLength(2);
    });

    it("should return empty array when no matches", async () => {
      const results = await searchOrganizationalUnits("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("clearOrganizationalUnitCache", () => {
    it("should clear all cached units", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Berlin Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
        {
          id: "unit-2",
          type: "company",
          name: "SecPal GmbH",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );
      expect(await db.organizationalUnitCache.count()).toBe(2);

      await clearOrganizationalUnitCache();
      expect(await db.organizationalUnitCache.count()).toBe(0);
    });
  });

  describe("getPendingSyncUnits", () => {
    it("should return units with pendingSync flag", async () => {
      const units: OrganizationalUnitCacheEntry[] = [
        {
          id: "unit-1",
          type: "branch",
          name: "Berlin Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
          pendingSync: true,
        },
        {
          id: "unit-2",
          type: "company",
          name: "SecPal GmbH",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
          pendingSync: false,
        },
        {
          id: "unit-3",
          type: "branch",
          name: "Hamburg Branch",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          cachedAt: new Date("2025-01-10T00:00:00Z"),
          lastSynced: new Date("2025-01-10T00:00:00Z"),
          pendingSync: true,
        },
      ];

      await Promise.all(
        units.map((unit) => db.organizationalUnitCache.put(unit))
      );

      const pending = await getPendingSyncUnits();
      expect(pending).toHaveLength(2);
      expect(pending[0].name).toBe("Berlin Branch");
      expect(pending[1].name).toBe("Hamburg Branch");
    });

    it("should return empty array when no pending units", async () => {
      const pending = await getPendingSyncUnits();
      expect(pending).toEqual([]);
    });
  });
});
