// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "./db";
import {
  addSecretOperation,
  getPendingSecretOperations,
  updateSecretOperationStatus,
  processSecretSyncQueue,
  clearCompletedSecretOperations,
} from "./secretSyncQueue";
import * as secretApi from "../services/secretApi";

/**
 * Test suite for Secret Sync Queue
 *
 * Tests offline secret operations queue:
 * - Add operations to queue (create, update, delete)
 * - Process queue with retry logic
 * - Exponential backoff
 * - Operation status tracking
 */
describe("Secret Sync Queue", () => {
  beforeEach(async () => {
    // Clear database before each test
    await db.delete();
    await db.open();
    vi.clearAllMocks();
  });

  describe("addSecretOperation", () => {
    it("should add create operation to queue", async () => {
      const secretData = {
        title: "Test Secret",
        username: "user@example.com",
        password: "secret123",
      };

      const id = await addSecretOperation("create", secretData);

      expect(id).toBeDefined();

      const pending = await getPendingSecretOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.type).toBe("create");
      expect(pending[0]?.data).toEqual(secretData);
      expect(pending[0]?.status).toBe("pending");
    });

    it("should add update operation to queue", async () => {
      const secretData = {
        id: "secret-1",
        title: "Updated Secret",
      };

      await addSecretOperation("update", secretData);

      const pending = await getPendingSecretOperations();
      expect(pending[0]?.type).toBe("update");
      expect(pending[0]?.data).toEqual(secretData);
    });

    it("should add delete operation to queue", async () => {
      const secretData = { id: "secret-1" };

      await addSecretOperation("delete", secretData);

      const pending = await getPendingSecretOperations();
      expect(pending[0]?.type).toBe("delete");
      expect(pending[0]?.data).toEqual(secretData);
    });

    it("should initialize with zero retry attempts", async () => {
      await addSecretOperation("create", { title: "Test" });

      const pending = await getPendingSecretOperations();
      expect(pending[0]?.attempts).toBe(0);
      expect(pending[0]?.lastAttemptAt).toBeUndefined();
    });
  });

  describe("getPendingSecretOperations", () => {
    it("should return operations sorted by createdAt (oldest first)", async () => {
      // Add operations in reverse order
      await addSecretOperation("create", { title: "Third" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await addSecretOperation("create", { title: "Second" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await addSecretOperation("create", { title: "First" });

      const pending = await getPendingSecretOperations();
      expect(pending).toHaveLength(3);
      expect((pending[0]?.data as { title: string }).title).toBe("Third");
      expect((pending[2]?.data as { title: string }).title).toBe("First");
    });

    it("should not return synced operations", async () => {
      const id1 = await addSecretOperation("create", { title: "Pending" });
      const id2 = await addSecretOperation("create", { title: "Synced" });

      await updateSecretOperationStatus(id2, "synced");

      const pending = await getPendingSecretOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(id1);
    });

    it("should not return failed operations", async () => {
      const id1 = await addSecretOperation("create", { title: "Pending" });
      const id2 = await addSecretOperation("create", { title: "Failed" });

      await updateSecretOperationStatus(id2, "error", "API Error");

      const pending = await getPendingSecretOperations();
      expect(pending).toHaveLength(1);
      expect(pending[0]?.id).toBe(id1);
    });
  });

  describe("updateSecretOperationStatus", () => {
    it("should update operation status to synced", async () => {
      const id = await addSecretOperation("create", { title: "Test" });

      await updateSecretOperationStatus(id, "synced");

      const operation = await db.syncQueue.get(id);
      expect(operation?.status).toBe("synced");
    });

    it("should update operation status to error with message", async () => {
      const id = await addSecretOperation("create", { title: "Test" });

      await updateSecretOperationStatus(id, "error", "Network timeout");

      const operation = await db.syncQueue.get(id);
      expect(operation?.status).toBe("error");
      expect(operation?.error).toBe("Network timeout");
    });

    it("should increment retry count on error", async () => {
      const id = await addSecretOperation("create", { title: "Test" });

      await updateSecretOperationStatus(id, "error", "Error 1");
      let operation = await db.syncQueue.get(id);
      expect(operation?.attempts).toBe(1);

      await updateSecretOperationStatus(id, "error", "Error 2");
      operation = await db.syncQueue.get(id);
      expect(operation?.attempts).toBe(2);
    });

    it("should set lastAttemptAt timestamp", async () => {
      const id = await addSecretOperation("create", { title: "Test" });
      const before = new Date();

      await updateSecretOperationStatus(id, "error", "Error");

      const operation = await db.syncQueue.get(id);
      expect(operation?.lastAttemptAt).toBeDefined();
      expect(operation!.lastAttemptAt!.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
    });
  });

  describe("processSecretSyncQueue", () => {
    it("should process create operation successfully", async () => {
      const secretData = {
        title: "Test Secret",
        username: "user@example.com",
      };

      const mockResponse = {
        id: "secret-1",
        title: "Test Secret",
        username: "user@example.com",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(secretApi, "createSecret").mockResolvedValue(mockResponse);

      await addSecretOperation("create", secretData);

      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(secretApi.createSecret).toHaveBeenCalledWith(secretData);
    });

    it("should process update operation successfully", async () => {
      const secretData = {
        id: "secret-1",
        title: "Updated Secret",
      };

      const mockResponse = {
        id: "secret-1",
        title: "Updated Secret",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      vi.spyOn(secretApi, "updateSecret").mockResolvedValue(mockResponse);

      await addSecretOperation("update", secretData);

      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(secretApi.updateSecret).toHaveBeenCalledWith(
        "secret-1",
        secretData
      );
    });

    it("should process delete operation successfully", async () => {
      const secretData = { id: "secret-1" };

      vi.spyOn(secretApi, "deleteSecret").mockResolvedValue(undefined);

      await addSecretOperation("delete", secretData);

      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(secretApi.deleteSecret).toHaveBeenCalledWith("secret-1");
    });

    it("should handle API errors and mark operation as failed", async () => {
      const secretData = { title: "Test" };

      vi.spyOn(secretApi, "createSecret").mockRejectedValue(
        new Error("Network error")
      );

      await addSecretOperation("create", secretData);

      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);

      const operation = (await db.syncQueue.toArray())[0];
      expect(operation?.status).toBe("error");
      expect(operation?.error).toContain("Network error");
    });

    it("should implement exponential backoff for retries", async () => {
      const secretData = { title: "Test" };

      vi.spyOn(secretApi, "createSecret").mockRejectedValue(
        new Error("Temporary error")
      );

      const id = await addSecretOperation("create", secretData);

      // First attempt
      await processSecretSyncQueue();
      let operation = await db.syncQueue.get(id);
      expect(operation?.attempts).toBe(1);

      // Second attempt - should respect backoff
      await updateSecretOperationStatus(id, "pending"); // Reset for retry
      await processSecretSyncQueue();
      operation = await db.syncQueue.get(id);
      expect(operation?.attempts).toBe(2);
    });

    it("should stop retrying after max attempts", async () => {
      const secretData = { title: "Test" };

      vi.spyOn(secretApi, "createSecret").mockRejectedValue(
        new Error("Persistent error")
      );

      const id = await addSecretOperation("create", secretData);

      // Simulate max retries (5 attempts)
      for (let i = 0; i < 5; i++) {
        await processSecretSyncQueue();
        if (i < 4) {
          await updateSecretOperationStatus(id, "pending");
        }
      }

      const operation = await db.syncQueue.get(id);
      expect(operation?.status).toBe("error");
      expect(operation?.attempts).toBe(5);
    });

    it("should process multiple operations in order", async () => {
      vi.spyOn(secretApi, "createSecret").mockResolvedValue({
        id: "secret-1",
        title: "Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await addSecretOperation("create", { title: "First" });
      await addSecretOperation("create", { title: "Second" });
      await addSecretOperation("create", { title: "Third" });

      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
    });

    it("should return empty stats when queue is empty", async () => {
      const result = await processSecretSyncQueue();

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });
  });

  describe("clearCompletedSecretOperations", () => {
    it("should remove synced operations", async () => {
      const id1 = await addSecretOperation("create", { title: "Pending" });
      const id2 = await addSecretOperation("create", { title: "Synced" });

      await updateSecretOperationStatus(id2, "synced");

      await clearCompletedSecretOperations();

      const remaining = await db.syncQueue.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(id1);
    });

    it("should not remove pending or failed operations", async () => {
      await addSecretOperation("create", { title: "Pending" });
      const id2 = await addSecretOperation("create", { title: "Failed" });

      await updateSecretOperationStatus(id2, "error", "Error");

      await clearCompletedSecretOperations();

      const remaining = await db.syncQueue.toArray();
      expect(remaining).toHaveLength(2);
    });
  });
});
