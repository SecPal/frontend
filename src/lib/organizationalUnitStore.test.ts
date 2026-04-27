// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db, type VaultOrganizationalUnitCacheRecord } from "./db";
import type { OrganizationalUnitCacheEntry } from "./db";
import type { OrganizationalUnit } from "../types/organizational";
import {
  buildOrganizationalUnitCacheEntry,
  saveOrganizationalUnit,
  getOrganizationalUnit,
  listOrganizationalUnits,
  deleteOrganizationalUnit,
  getOrganizationalUnitsByType,
  getOrganizationalUnitsByParent,
  searchOrganizationalUnits,
  clearOrganizationalUnitCache,
} from "./organizationalUnitStore";
import {
  clearOfflineVaultSession,
  initializeOfflineVault,
} from "./offlineVault";

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

describe("buildOrganizationalUnitCacheEntry", () => {
  const baseUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Branch",
    custom_type_name: null,
    description: "A description that must not be cached",
    metadata: { key: "value" },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  };

  it("maps route/tree fields correctly", () => {
    const entry = buildOrganizationalUnitCacheEntry(baseUnit);

    expect(entry.id).toBe("unit-1");
    expect(entry.type).toBe("branch");
    expect(entry.name).toBe("Berlin Branch");
    expect(entry.created_at).toBe("2025-01-01T00:00:00Z");
    expect(entry.updated_at).toBe("2025-01-02T00:00:00Z");
  });

  it("omits description and metadata fields from the cache entry", () => {
    const entry = buildOrganizationalUnitCacheEntry(baseUnit);

    expect(entry).not.toHaveProperty("description");
    expect(entry).not.toHaveProperty("metadata");
  });

  it("derives parent_id from unit.parent.id when parent is present", () => {
    const unitWithParent: OrganizationalUnit = {
      ...baseUnit,
      parent: {
        id: "parent-1",
        type: "company",
        name: "HQ",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    };

    const entry = buildOrganizationalUnitCacheEntry(unitWithParent);

    expect(entry.parent_id).toBe("parent-1");
    expect(entry.parent).toEqual({
      id: "parent-1",
      type: "company",
      name: "HQ",
    });
  });

  it("sets parent_id to null when unit has no parent", () => {
    const entry = buildOrganizationalUnitCacheEntry(baseUnit);

    expect(entry.parent_id).toBeNull();
    expect(entry.parent).toBeNull();
  });

  it("defaults cachedAt and lastSynced to current time when syncedAt is omitted", () => {
    const before = new Date();
    const entry = buildOrganizationalUnitCacheEntry(baseUnit);
    const after = new Date();

    expect(entry.cachedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(entry.cachedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    expect(entry.lastSynced).toEqual(entry.cachedAt);
  });

  it("uses explicit syncedAt when provided", () => {
    const syncedAt = new Date("2026-01-15T10:00:00Z");
    const entry = buildOrganizationalUnitCacheEntry(baseUnit, syncedAt);

    expect(entry.cachedAt).toBe(syncedAt);
    expect(entry.lastSynced).toBe(syncedAt);
  });
});

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
    localStorage.clear();
    clearOfflineVaultSession();
    setCsrfTokenCookie("test-csrf-token");
    await initializeOfflineVault({
      id: "user-1",
      name: "Vault User",
      email: "vault@secpal.dev",
      emailVerified: false,
    });
  });

  describe("saveOrganizationalUnit", () => {
    it("returns Date instances for cachedAt and lastSynced after vault round-trip", async () => {
      const cachedAt = new Date("2025-01-10T00:00:00Z");
      const lastSynced = new Date("2025-01-10T00:00:00Z");
      const unit: OrganizationalUnitCacheEntry = {
        id: "unit-date-roundtrip",
        type: "branch",
        name: "Round-trip Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt,
        lastSynced,
      };

      await saveOrganizationalUnit(unit);

      const saved = await getOrganizationalUnit("unit-date-roundtrip");
      expect(saved).toBeDefined();
      expect(saved?.cachedAt).toBeInstanceOf(Date);
      expect(saved?.lastSynced).toBeInstanceOf(Date);
      expect(saved?.cachedAt.getTime()).toBe(cachedAt.getTime());
      expect(saved?.lastSynced.getTime()).toBe(lastSynced.getTime());

      const listed = await listOrganizationalUnits();
      const listedUnit = listed.find((u) => u.id === "unit-date-roundtrip");
      expect(listedUnit?.cachedAt).toBeInstanceOf(Date);
      expect(listedUnit?.lastSynced).toBeInstanceOf(Date);
    });

    it("should save an organizational unit to IndexedDB", async () => {
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

      const saved = await getOrganizationalUnit("unit-1");
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

      const saved = await getOrganizationalUnit("unit-1");
      expect(saved?.name).toBe("Berlin Branch (Updated)");
      expect(saved?.updated_at).toBe("2025-01-11T00:00:00Z");

      // Should still have only one entry
      const allUnits = await listOrganizationalUnits();
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
      expect(retrieved[0]!.name).toBe("Alpha Company");
      expect(retrieved[1]!.name).toBe("Beta Region");
      expect(retrieved[2]!.name).toBe("Zebra Branch");
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
      expect(await getOrganizationalUnit("unit-1")).toBeDefined();

      await deleteOrganizationalUnit("unit-1");
      expect(await getOrganizationalUnit("unit-1")).toBeUndefined();
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
      expect(branches[0]!.name).toBe("Berlin Branch");
      expect(branches[1]!.name).toBe("Hamburg Branch");

      const companies = await getOrganizationalUnitsByType("company");
      expect(companies).toHaveLength(1);
      expect(companies[0]!.name).toBe("SecPal GmbH");
    });

    it("should return empty array when no units match type", async () => {
      const units = await getOrganizationalUnitsByType("holding");
      expect(units).toEqual([]);
    });

    it("decrypts only matching vault records for indexed type lookups", async () => {
      await saveOrganizationalUnit({
        id: "branch-1",
        type: "branch",
        name: "Berlin Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });
      await saveOrganizationalUnit({
        id: "branch-2",
        type: "branch",
        name: "Hamburg Branch",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });
      await saveOrganizationalUnit({
        id: "company-1",
        type: "company",
        name: "SecPal GmbH",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });

      const decryptSpy = vi.spyOn(crypto.subtle, "decrypt");

      const branches = await getOrganizationalUnitsByType("branch");

      expect(branches.map((unit) => unit.id)).toEqual(["branch-1", "branch-2"]);
      expect(decryptSpy).toHaveBeenCalledTimes(2);
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
      expect(children[0]!.name).toBe("Berlin Branch");
      expect(children[1]!.name).toBe("Hamburg Branch");
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
      expect(rootUnits[0]!.name).toBe("Root Holding");
    });

    it("decrypts only matching vault records for indexed parent lookups", async () => {
      await saveOrganizationalUnit({
        id: "company-1",
        type: "company",
        name: "SecPal GmbH",
        parent_id: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });
      await saveOrganizationalUnit({
        id: "branch-1",
        type: "branch",
        name: "Berlin Branch",
        parent_id: "company-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });
      await saveOrganizationalUnit({
        id: "branch-2",
        type: "branch",
        name: "Hamburg Branch",
        parent_id: "company-2",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });

      const decryptSpy = vi.spyOn(crypto.subtle, "decrypt");

      const children = await getOrganizationalUnitsByParent("company-1");

      expect(children.map((unit) => unit.id)).toEqual(["branch-1"]);
      expect(decryptSpy).toHaveBeenCalledTimes(1);
    });

    it("backfills missing vault org-unit index fields during filtered lookups", async () => {
      await saveOrganizationalUnit({
        id: "company-1",
        type: "company",
        name: "SecPal GmbH",
        parent_id: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });
      await saveOrganizationalUnit({
        id: "branch-1",
        type: "branch",
        name: "Berlin Branch",
        parent_id: "company-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        cachedAt: new Date("2025-01-10T00:00:00Z"),
        lastSynced: new Date("2025-01-10T00:00:00Z"),
      });

      const branchRecord = await db.vaultOrganizationalUnitCache.get("branch-1");
      const companyRecord = await db.vaultOrganizationalUnitCache.get("company-1");

      const toLegacyRecord = (record: VaultOrganizationalUnitCacheRecord) => {
        const legacyRecord = {
          ...record,
        } as Partial<VaultOrganizationalUnitCacheRecord>;

        delete legacyRecord.type;
        delete legacyRecord.parent_id;
        delete legacyRecord.parentLookupKey;

        return legacyRecord as VaultOrganizationalUnitCacheRecord;
      };

      await db.vaultOrganizationalUnitCache.bulkPut(
        [branchRecord, companyRecord]
          .filter((record): record is NonNullable<typeof record> => record !== undefined)
          .map(toLegacyRecord)
      );

      await expect(getOrganizationalUnitsByType("branch")).resolves.toEqual([
        expect.objectContaining({ id: "branch-1" }),
      ]);
      await expect(db.vaultOrganizationalUnitCache.get("branch-1")).resolves.toEqual(
        expect.objectContaining({
          type: "branch",
          parent_id: "company-1",
          parentLookupKey: "company-1",
        })
      );
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
      expect(results[0]!.name).toBe("Berlin Branch");
      expect(results[1]!.name).toBe("Berlin Company");

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
      expect((await listOrganizationalUnits()).length).toBe(2);

      await clearOrganizationalUnitCache();
      expect(await listOrganizationalUnits()).toEqual([]);
    });
  });
});
