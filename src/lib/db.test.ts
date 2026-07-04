// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { DB_VERSION } from "./db-constants";

describe("IndexedDB Database", () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.analytics.clear();
    await db.organizationalUnitCache.clear();
    await db.vaultProfile.clear();
    await db.vaultAnalytics.clear();
    await db.vaultOrganizationalUnitCache.clear();
  });

  describe("Database Metadata", () => {
    it("should have correct database name", () => {
      expect(db.name).toBe("SecPalDB");
    });

    it(`should have version ${DB_VERSION}`, () => {
      expect(db.verno).toBe(DB_VERSION);
    });

    it("keeps only the currently supported offline tables in the live schema", () => {
      const tableNames = db.tables.map((table) => table.name);

      expect(tableNames).toContain("analytics");
      expect(tableNames).toContain("organizationalUnitCache");
      expect(tableNames).toContain("vaultProfile");
      expect(tableNames).toContain("vaultAnalytics");
      expect(tableNames).toContain("vaultOrganizationalUnitCache");
      expect(tableNames).not.toContain("guards");
      expect(tableNames).not.toContain("syncQueue");
      expect(tableNames).not.toContain("apiCache");
    });

    it("indexes vault organizational units by type and parent_id", () => {
      const indexNames = db.vaultOrganizationalUnitCache.schema.indexes.map(
        (index) => index.name
      );

      expect(indexNames).toEqual(
        expect.arrayContaining(["type", "parentLookupKey", "parent_id"])
      );
    });
  });
});
