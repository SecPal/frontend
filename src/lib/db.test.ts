// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";

describe("IndexedDB Database", () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.analytics.clear();
    await db.organizationalUnitCache.clear();
  });

  describe("Database Metadata", () => {
    it("should have correct database name", () => {
      expect(db.name).toBe("SecPalDB");
    });

    it("should have version 9", () => {
      expect(db.verno).toBe(9);
    });

    it("keeps only the currently supported offline tables in the live schema", () => {
      const tableNames = db.tables.map((table) => table.name);

      expect(tableNames).toContain("analytics");
      expect(tableNames).toContain("organizationalUnitCache");
      expect(tableNames).not.toContain("guards");
      expect(tableNames).not.toContain("syncQueue");
      expect(tableNames).not.toContain("apiCache");
    });
  });
});
