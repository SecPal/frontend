// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  cacheApiResponse,
  getCachedResponse,
  addToSyncQueue,
  getPendingSyncOperations,
  checkStorageQuota,
  cleanExpiredCache,
} from "./apiCache";
import { db } from "./db";

describe("API Cache Utilities", () => {
  beforeEach(async () => {
    await db.apiCache.clear();
    await db.syncQueue.clear();
  });

  describe("cacheApiResponse", () => {
    it("should cache API response with TTL", async () => {
      const url = "/api/v1/guards";
      const data = [{ id: "1", name: "Test Guard" }];

      await cacheApiResponse(url, data);

      const cached = await db.apiCache.get(url);
      expect(cached).toBeDefined();
      expect(cached?.url).toBe(url);
      expect(cached?.data).toEqual(data);
      expect(cached?.cachedAt).toBeInstanceOf(Date);
      expect(cached?.expiresAt).toBeInstanceOf(Date);
    });

    it("should set expiration to 24 hours by default", async () => {
      const url = "/api/v1/test";
      const data = { test: true };
      const beforeCache = Date.now();

      await cacheApiResponse(url, data);

      const cached = await db.apiCache.get(url);
      const expectedExpiry = beforeCache + 24 * 60 * 60 * 1000; // 24h
      const actualExpiry = cached?.expiresAt.getTime() || 0;

      // Allow 1 second tolerance
      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });

    it("should allow custom TTL", async () => {
      const url = "/api/v1/custom-ttl";
      const data = { test: true };
      const customTtl = 60 * 60 * 1000; // 1 hour
      const beforeCache = Date.now();

      await cacheApiResponse(url, data, customTtl);

      const cached = await db.apiCache.get(url);
      const expectedExpiry = beforeCache + customTtl;
      const actualExpiry = cached?.expiresAt.getTime() || 0;

      expect(Math.abs(actualExpiry - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe("getCachedResponse", () => {
    it("should retrieve valid cached response", async () => {
      const url = "/api/v1/guards";
      const data = [{ id: "1", name: "Cached" }];

      await cacheApiResponse(url, data);
      const retrieved = await getCachedResponse(url);

      expect(retrieved).toEqual(data);
    });

    it("should return null for expired cache", async () => {
      const url = "/api/v1/expired";
      const data = { test: true };

      // Cache with negative TTL (already expired)
      await db.apiCache.put({
        url,
        data,
        cachedAt: new Date(Date.now() - 2000),
        expiresAt: new Date(Date.now() - 1000),
      });

      const retrieved = await getCachedResponse(url);
      expect(retrieved).toBeNull();
    });

    it("should return null for non-existent cache", async () => {
      const retrieved = await getCachedResponse("/api/v1/nonexistent");
      expect(retrieved).toBeNull();
    });
  });

  describe("addToSyncQueue", () => {
    it("should add operation to sync queue", async () => {
      const operation = {
        type: "create" as const,
        entity: "guard",
        data: { name: "New Guard", email: "test@secpal.app" },
      };

      const id = await addToSyncQueue(operation);

      expect(id).toBeDefined();
      expect(typeof id).toBe("string");

      const queued = await db.syncQueue.get(id);
      expect(queued).toBeDefined();
      expect(queued?.type).toBe("create");
      expect(queued?.entity).toBe("guard");
      expect(queued?.status).toBe("pending");
      expect(queued?.attempts).toBe(0);
    });

    it("should generate unique IDs for operations", async () => {
      const op1 = await addToSyncQueue({
        type: "create",
        entity: "guard",
        data: {},
      });
      const op2 = await addToSyncQueue({
        type: "update",
        entity: "shift",
        data: {},
      });

      expect(op1).not.toBe(op2);
    });
  });

  describe("getPendingSyncOperations", () => {
    it("should return only pending operations", async () => {
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

      const pending = await getPendingSyncOperations();

      expect(pending).toHaveLength(2);
      expect(pending.every((op) => op.status === "pending")).toBe(true);
    });

    it("should return empty array when no pending operations", async () => {
      const pending = await getPendingSyncOperations();
      expect(pending).toEqual([]);
    });

    it("should order by createdAt ascending (oldest first)", async () => {
      const now = Date.now();
      await db.syncQueue.bulkAdd([
        {
          id: "1",
          type: "create",
          entity: "guard",
          data: {},
          status: "pending",
          createdAt: new Date(now + 2000),
          attempts: 0,
        },
        {
          id: "2",
          type: "update",
          entity: "shift",
          data: {},
          status: "pending",
          createdAt: new Date(now + 1000),
          attempts: 0,
        },
        {
          id: "3",
          type: "delete",
          entity: "report",
          data: {},
          status: "pending",
          createdAt: new Date(now),
          attempts: 0,
        },
      ]);

      const pending = await getPendingSyncOperations();

      expect(pending[0].id).toBe("3"); // Oldest
      expect(pending[1].id).toBe("2");
      expect(pending[2].id).toBe("1"); // Newest
    });
  });

  describe("checkStorageQuota", () => {
    it("should return storage usage info", async () => {
      // Mock navigator.storage.estimate
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 1000000, // 1 MB
        quota: 10000000, // 10 MB
      });

      vi.stubGlobal("navigator", {
        storage: { estimate: mockEstimate },
      });

      const quota = await checkStorageQuota();

      expect(quota).toBeDefined();
      expect(quota?.usage).toBe(1000000);
      expect(quota?.quota).toBe(10000000);
      expect(quota?.percentUsed).toBe(10);

      vi.unstubAllGlobals();
    });

    it("should return null when Storage API not available", async () => {
      vi.stubGlobal("navigator", {});

      const quota = await checkStorageQuota();
      expect(quota).toBeNull();

      vi.unstubAllGlobals();
    });
  });

  describe("cleanExpiredCache", () => {
    it("should delete only expired entries", async () => {
      const now = Date.now();

      await db.apiCache.bulkPut([
        {
          url: "/api/expired1",
          data: {},
          cachedAt: new Date(now - 2000),
          expiresAt: new Date(now - 1000),
        },
        {
          url: "/api/expired2",
          data: {},
          cachedAt: new Date(now - 3000),
          expiresAt: new Date(now - 500),
        },
        {
          url: "/api/valid",
          data: {},
          cachedAt: new Date(now),
          expiresAt: new Date(now + 86400000),
        },
      ]);

      const deleted = await cleanExpiredCache();

      expect(deleted).toBe(2);

      const remaining = await db.apiCache.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].url).toBe("/api/valid");
    });

    it("should return 0 when no expired entries", async () => {
      await db.apiCache.put({
        url: "/api/valid",
        data: {},
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });

      const deleted = await cleanExpiredCache();
      expect(deleted).toBe(0);
    });
  });
});
