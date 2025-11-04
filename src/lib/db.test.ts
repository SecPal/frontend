// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import type { Guard, SyncOperation, ApiCacheEntry } from "./db";

describe("IndexedDB Database", () => {
  beforeEach(async () => {
    // Clear all tables before each test
    await db.guards.clear();
    await db.syncQueue.clear();
    await db.apiCache.clear();
  });

  describe("Guards Table", () => {
    it("should add a guard to the database", async () => {
      const guard: Guard = {
        id: "test-uuid-1",
        name: "John Doe",
        email: "john@secpal.app",
        lastSynced: new Date(),
      };

      await db.guards.add(guard);

      const retrieved = await db.guards.get("test-uuid-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe("John Doe");
      expect(retrieved?.email).toBe("john@secpal.app");
    });

    it("should query guards by email", async () => {
      await db.guards.bulkAdd([
        {
          id: "1",
          name: "Alice",
          email: "alice@secpal.app",
          lastSynced: new Date(),
        },
        {
          id: "2",
          name: "Bob",
          email: "bob@example.com",
          lastSynced: new Date(),
        },
        {
          id: "3",
          name: "Charlie",
          email: "charlie@secpal.app",
          lastSynced: new Date(),
        },
      ]);

      // Filter using .filter() since Dexie doesn't have .endsWith()
      const secpalGuards = await db.guards
        .filter((guard: Guard) => guard.email.endsWith("@secpal.app"))
        .toArray();

      expect(secpalGuards).toHaveLength(2);
      expect(secpalGuards.map((g) => g.name)).toContain("Alice");
      expect(secpalGuards.map((g) => g.name)).toContain("Charlie");
    });

    it("should update a guard", async () => {
      const guard: Guard = {
        id: "update-test",
        name: "Initial Name",
        email: "test@secpal.app",
        lastSynced: new Date(),
      };

      await db.guards.add(guard);
      await db.guards.update("update-test", { name: "Updated Name" });

      const updated = await db.guards.get("update-test");
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.email).toBe("test@secpal.app");
    });

    it("should delete a guard", async () => {
      const guard: Guard = {
        id: "delete-test",
        name: "To Delete",
        email: "delete@secpal.app",
        lastSynced: new Date(),
      };

      await db.guards.add(guard);
      await db.guards.delete("delete-test");

      const retrieved = await db.guards.get("delete-test");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("Sync Queue Table", () => {
    it("should add operation to sync queue", async () => {
      const operation: SyncOperation = {
        id: "sync-1",
        type: "create",
        entity: "guard",
        data: { name: "New Guard" },
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      };

      await db.syncQueue.add(operation);

      const retrieved = await db.syncQueue.get("sync-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe("create");
      expect(retrieved?.status).toBe("pending");
    });

    it("should query pending operations", async () => {
      await db.syncQueue.bulkAdd([
        {
          id: "1",
          type: "create",
          entity: "guard",
          data: {},
          status: "pending",
          createdAt: new Date(),
          attempts: 0,
        },
        {
          id: "2",
          type: "update",
          entity: "shift",
          data: {},
          status: "completed",
          createdAt: new Date(),
          attempts: 1,
        },
        {
          id: "3",
          type: "delete",
          entity: "report",
          data: {},
          status: "pending",
          createdAt: new Date(),
          attempts: 0,
        },
      ]);

      const pending = await db.syncQueue
        .where("status")
        .equals("pending")
        .toArray();

      expect(pending).toHaveLength(2);
      expect(pending.every((op) => op.status === "pending")).toBe(true);
    });

    it("should increment attempt count on retry", async () => {
      const operation: SyncOperation = {
        id: "retry-test",
        type: "create",
        entity: "guard",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      };

      await db.syncQueue.add(operation);
      await db.syncQueue.update("retry-test", { attempts: 1 });

      const retrieved = await db.syncQueue.get("retry-test");
      expect(retrieved?.attempts).toBe(1);
    });
  });

  describe("API Cache Table", () => {
    it("should cache API response", async () => {
      const cacheEntry: ApiCacheEntry = {
        url: "/api/v1/guards",
        data: [{ id: "1", name: "Cached Guard" }],
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000), // 24h
      };

      await db.apiCache.put(cacheEntry);

      const retrieved = await db.apiCache.get("/api/v1/guards");
      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toEqual([{ id: "1", name: "Cached Guard" }]);
    });

    it("should delete expired cache entries", async () => {
      const now = new Date();
      const expired = new Date(now.getTime() - 1000); // 1 second ago

      await db.apiCache.bulkPut([
        {
          url: "/api/expired",
          data: {},
          cachedAt: expired,
          expiresAt: expired,
        },
        {
          url: "/api/valid",
          data: {},
          cachedAt: now,
          expiresAt: new Date(now.getTime() + 86400000),
        },
      ]);

      // Delete expired entries
      await db.apiCache.where("expiresAt").below(now).delete();

      const remaining = await db.apiCache.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].url).toBe("/api/valid");
    });
  });

  describe("Database Metadata", () => {
    it("should have correct database name", () => {
      expect(db.name).toBe("SecPalDB");
    });

    it("should have version 1", () => {
      expect(db.verno).toBe(1);
    });

    it("should have all required tables", () => {
      const tableNames = db.tables.map((table) => table.name);
      expect(tableNames).toContain("guards");
      expect(tableNames).toContain("syncQueue");
      expect(tableNames).toContain("apiCache");
    });
  });
});
