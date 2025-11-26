// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  cacheApiResponse,
  getCachedResponse,
  addToSyncQueue,
  getPendingSyncOperations,
  checkStorageQuota,
  cleanExpiredCache,
  updateSyncOperationStatus,
  retrySyncOperation,
  processSyncQueue,
  clearCompletedSyncOperations,
} from "./apiCache";
import { db } from "./db";

describe("API Cache Utilities", () => {
  beforeEach(async () => {
    await db.apiCache.clear();
    await db.syncQueue.clear();
  });

  describe("cacheApiResponse", () => {
    it("should cache API response with TTL", async () => {
      const url = "/v1/guards";
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
      const url = "/v1/test";
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
      const url = "/v1/custom-ttl";
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
      const url = "/v1/guards";
      const data = [{ id: "1", name: "Cached" }];

      await cacheApiResponse(url, data);
      const retrieved = await getCachedResponse(url);

      expect(retrieved).toEqual(data);
    });

    it("should return null for expired cache", async () => {
      const url = "/v1/expired";
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
      const retrieved = await getCachedResponse("/v1/nonexistent");
      expect(retrieved).toBeNull();
    });
  });

  describe("addToSyncQueue", () => {
    it("should add operation to sync queue", async () => {
      const operation = {
        type: "create" as const,
        entity: "guard",
        data: { name: "New Guard", email: "test@secpal.dev" },
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
          status: "synced",
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

      expect(pending).toHaveLength(3);
      expect(pending[0]?.id).toBe("3"); // Oldest
      expect(pending[1]?.id).toBe("2");
      expect(pending[2]?.id).toBe("1"); // Newest
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
      expect(remaining[0]?.url).toBe("/api/valid");
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

  describe("updateSyncOperationStatus", () => {
    it("should update operation status", async () => {
      const id = await addToSyncQueue({
        type: "create",
        entity: "guard",
        data: {},
      });

      await updateSyncOperationStatus(id, "synced");

      const operation = await db.syncQueue.get(id);
      expect(operation?.status).toBe("synced");
      expect(operation?.attempts).toBe(1);
      expect(operation?.lastAttemptAt).toBeInstanceOf(Date);
    });

    it("should store error message", async () => {
      const id = await addToSyncQueue({
        type: "create",
        entity: "guard",
        data: {},
      });

      await updateSyncOperationStatus(id, "error", "Network timeout");

      const operation = await db.syncQueue.get(id);
      expect(operation?.status).toBe("error");
      expect(operation?.error).toBe("Network timeout");
    });

    it("should throw error if operation not found", async () => {
      await expect(
        updateSyncOperationStatus("nonexistent-id", "synced")
      ).rejects.toThrow("Sync operation nonexistent-id not found");
    });
  });

  describe("retrySyncOperation", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should successfully sync CREATE operation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
      });
      vi.stubGlobal("fetch", mockFetch);

      const id = await addToSyncQueue({
        type: "create",
        entity: "guards",
        data: { name: "John Doe" },
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://api.secpal.dev/guards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "John Doe" }),
      });

      const updated = await db.syncQueue.get(id);
      expect(updated?.status).toBe("synced");

      vi.unstubAllGlobals();
    });

    it("should successfully sync UPDATE operation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal("fetch", mockFetch);

      const id = await addToSyncQueue({
        type: "update",
        entity: "guards/123",
        data: { name: "Updated Name" },
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.secpal.dev/guards/123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated Name" }),
        }
      );

      vi.unstubAllGlobals();
    });

    it("should successfully sync DELETE operation", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });
      vi.stubGlobal("fetch", mockFetch);

      const id = await addToSyncQueue({
        type: "delete",
        entity: "guards/123",
        data: {},
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.secpal.dev/guards/123",
        {
          method: "DELETE",
          headers: {}, // Auth headers (empty when no token in localStorage)
        }
      );

      vi.unstubAllGlobals();
    });

    it("should handle HTTP errors", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "Bad Request",
      });
      vi.stubGlobal("fetch", mockFetch);

      const id = await addToSyncQueue({
        type: "create",
        entity: "guards",
        data: {},
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(false);

      const updated = await db.syncQueue.get(id);
      expect(updated?.status).toBe("error");
      expect(updated?.error).toContain("HTTP 400");

      vi.unstubAllGlobals();
    });

    it("should handle network errors", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      const id = await addToSyncQueue({
        type: "create",
        entity: "guards",
        data: {},
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(false);

      const updated = await db.syncQueue.get(id);
      expect(updated?.error).toBe("Network error");

      vi.unstubAllGlobals();
    });

    it("should reject after max retry attempts", async () => {
      const id = await addToSyncQueue({
        type: "create",
        entity: "guards",
        data: {},
      });

      // Simulate 5 failed attempts
      await db.syncQueue.update(id, { attempts: 5 });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(false);

      const updated = await db.syncQueue.get(id);
      expect(updated?.status).toBe("error");
      expect(updated?.error).toBe("Max retry attempts reached");
    });

    it("should implement exponential backoff", async () => {
      const id = await addToSyncQueue({
        type: "create",
        entity: "guards",
        data: {},
      });

      // Simulate recent failed attempt
      const recentTime = new Date(Date.now() - 500); // 0.5 seconds ago
      await db.syncQueue.update(id, {
        attempts: 2,
        lastAttemptAt: recentTime,
      });

      const operation = await db.syncQueue.get(id);
      if (!operation) throw new Error("Operation not found");

      // With 2 attempts, backoff = 2^2 * 1000 = 4000ms
      // Since last attempt was 500ms ago, should skip retry
      const success = await retrySyncOperation(
        operation,
        "https://api.secpal.dev"
      );

      expect(success).toBe(false);

      // Attempts should not increment
      const updated = await db.syncQueue.get(id);
      expect(updated?.attempts).toBe(2);
    });
  });

  describe("processSyncQueue", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should process all pending operations", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      vi.stubGlobal("fetch", mockFetch);

      await addToSyncQueue({ type: "create", entity: "guards", data: {} });
      await addToSyncQueue({ type: "update", entity: "shifts", data: {} });
      await addToSyncQueue({ type: "delete", entity: "reports", data: {} });

      const stats = await processSyncQueue("https://api.secpal.dev");

      expect(stats.total).toBe(3);
      expect(stats.synced).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);

      vi.unstubAllGlobals();
    });

    it("should handle mixed success and failures", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second call fails
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => "Server Error",
          });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });
      vi.stubGlobal("fetch", mockFetch);

      await addToSyncQueue({ type: "create", entity: "guards", data: {} });
      await addToSyncQueue({ type: "create", entity: "shifts", data: {} });
      await addToSyncQueue({ type: "create", entity: "reports", data: {} });

      const stats = await processSyncQueue("https://api.secpal.dev");

      expect(stats.total).toBe(3);
      expect(stats.synced).toBe(2);
      expect(stats.failed).toBe(1);

      vi.unstubAllGlobals();
    });

    it("should return zero stats when queue is empty", async () => {
      const stats = await processSyncQueue("https://api.secpal.dev");

      expect(stats.total).toBe(0);
      expect(stats.synced).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
    });
  });

  describe("clearCompletedSyncOperations", () => {
    it("should delete only synced operations", async () => {
      await db.syncQueue.bulkAdd([
        {
          id: "1",
          type: "create",
          entity: "guard",
          data: {},
          status: "synced",
          createdAt: new Date(),
          attempts: 1,
        },
        {
          id: "2",
          type: "update",
          entity: "shift",
          data: {},
          status: "pending",
          createdAt: new Date(),
          attempts: 0,
        },
        {
          id: "3",
          type: "delete",
          entity: "report",
          data: {},
          status: "synced",
          createdAt: new Date(),
          attempts: 1,
        },
        {
          id: "4",
          type: "create",
          entity: "guard",
          data: {},
          status: "error",
          createdAt: new Date(),
          attempts: 5,
        },
      ]);

      const deleted = await clearCompletedSyncOperations();

      expect(deleted).toBe(2);

      const remaining = await db.syncQueue.toArray();
      expect(remaining).toHaveLength(2);
      expect(remaining.every((op) => op.status !== "synced")).toBe(true);
    });

    it("should return 0 when no completed operations", async () => {
      await db.syncQueue.add({
        id: "1",
        type: "create",
        entity: "guard",
        data: {},
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      });

      const deleted = await clearCompletedSyncOperations();
      expect(deleted).toBe(0);
    });
  });
});
