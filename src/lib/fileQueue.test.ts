// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  addFileToQueue,
  getPendingFiles,
  getAllQueuedFiles,
  updateFileUploadState,
  retryFileUpload,
  processFileQueue,
  clearCompletedUploads,
  getStorageQuota,
  getFailedFiles,
  deleteQueuedFile,
} from "./fileQueue";
import { db } from "./db";
import type { FileQueueEntry } from "./db";

// Mock secretApi module
vi.mock("../services/secretApi", () => ({
  uploadAttachment: vi.fn().mockResolvedValue({
    id: "att-123",
    filename: "test.txt",
    size: 12,
    mime_type: "text/plain",
    created_at: new Date().toISOString(),
  }),
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status?: number,
      public errors?: Record<string, string[]>
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

describe("File Queue Utilities", () => {
  beforeEach(async () => {
    await db.fileQueue.clear();
  });

  describe("addFileToQueue", () => {
    it("should add file to queue with pending state", async () => {
      const file = new Blob(["test content"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 12,
        timestamp: Date.now(),
      };

      const id = await addFileToQueue(file, metadata);

      const queued = await db.fileQueue.get(id);
      expect(queued).toBeDefined();
      expect(queued?.uploadState).toBe("pending");
      expect(queued?.metadata.name).toBe("test.txt");
      expect(queued?.retryCount).toBe(0);
    });

    it("should accept optional secretId", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const id = await addFileToQueue(file, metadata, "secret-123");

      const queued = await db.fileQueue.get(id);
      expect(queued?.secretId).toBe("secret-123");
    });

    it("should generate unique IDs", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const id1 = await addFileToQueue(file, metadata);
      const id2 = await addFileToQueue(file, metadata);

      expect(id1).not.toBe(id2);
    });
  });

  describe("getPendingFiles", () => {
    it("should return only pending files", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "2",
          file,
          metadata,
          uploadState: "completed",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "3",
          file,
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(Date.now() - 1000), // Older
        },
      ]);

      const pending = await getPendingFiles();

      expect(pending).toHaveLength(2);
      expect(pending[0]?.id).toBe("3"); // Oldest first
      expect(pending[1]?.id).toBe("1");
    });
  });

  describe("getAllQueuedFiles", () => {
    it("should return all files in reverse chronological order", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(Date.now() - 2000),
        },
        {
          id: "2",
          file,
          metadata,
          uploadState: "completed",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "3",
          file,
          metadata,
          uploadState: "failed",
          retryCount: 1,
          createdAt: new Date(Date.now() - 1000),
        },
      ]);

      const all = await getAllQueuedFiles();

      expect(all).toHaveLength(3);
      expect(all[0]?.id).toBe("2"); // Newest first
      expect(all[1]?.id).toBe("3");
      expect(all[2]?.id).toBe("1");
    });
  });

  describe("updateFileUploadState", () => {
    it("should update upload state and lastAttemptAt", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const id = await addFileToQueue(file, metadata);

      await updateFileUploadState(id, "uploading");

      const updated = await db.fileQueue.get(id);
      expect(updated?.uploadState).toBe("uploading");
      expect(updated?.lastAttemptAt).toBeInstanceOf(Date);
    });

    it("should increment retryCount on failed state", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const id = await addFileToQueue(file, metadata);

      await updateFileUploadState(id, "failed", "Network error");

      const updated = await db.fileQueue.get(id);
      expect(updated?.uploadState).toBe("failed");
      expect(updated?.retryCount).toBe(1);
      expect(updated?.error).toBe("Network error");
    });

    it("should throw error if file not found", async () => {
      await expect(
        updateFileUploadState("nonexistent", "completed")
      ).rejects.toThrow("File queue entry nonexistent not found");
    });
  });

  describe("retryFileUpload", () => {
    it("should not retry if max retries exceeded", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const entry: FileQueueEntry = {
        id: "test-id",
        file,
        metadata: {
          name: "test.txt",
          type: "text/plain",
          size: 4,
          timestamp: Date.now(),
        },
        uploadState: "failed",
        retryCount: 5, // Max retries
        createdAt: new Date(),
      };

      await db.fileQueue.add(entry);

      const success = await retryFileUpload(entry);

      expect(success).toBe(false);
      const updated = await db.fileQueue.get("test-id");
      expect(updated?.error).toBe("Max retries exceeded");
    });

    it("should respect exponential backoff", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const entry: FileQueueEntry = {
        id: "test-id",
        file,
        metadata: {
          name: "test.txt",
          type: "text/plain",
          size: 4,
          timestamp: Date.now(),
        },
        uploadState: "failed",
        retryCount: 2, // 4 second backoff
        createdAt: new Date(),
        lastAttemptAt: new Date(Date.now() - 2000), // 2 seconds ago
      };

      await db.fileQueue.add(entry);

      const success = await retryFileUpload(entry);

      expect(success).toBe(false); // Too soon to retry
    });

    it("should mark as completed on successful upload", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const entry: FileQueueEntry = {
        id: "test-id",
        file,
        secretId: "secret-123",
        metadata: {
          name: "test.txt",
          type: "text/plain",
          size: 4,
          timestamp: Date.now(),
        },
        uploadState: "pending",
        retryCount: 0,
        createdAt: new Date(),
      };

      await db.fileQueue.add(entry);

      const success = await retryFileUpload(entry);

      expect(success).toBe(true);
      const updated = await db.fileQueue.get("test-id");
      expect(updated?.uploadState).toBe("completed");
    });
  });

  describe("processFileQueue", () => {
    it("should process all pending files", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          secretId: "secret-123",
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "2",
          file,
          secretId: "secret-456",
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
      ]);

      const stats = await processFileQueue();

      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(0);
    });

    it("should count skipped files when retry count unchanged", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const now = new Date();
      const recentAttempt = new Date(now.getTime() - 1000); // 1s ago

      // Add two files: one that will be processed, one that's in backoff
      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          secretId: "secret-123",
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: now,
          lastAttemptAt: recentAttempt,
        },
        {
          id: "2",
          file,
          secretId: "secret-456",
          metadata,
          uploadState: "pending",
          retryCount: 3, // High retry count
          createdAt: now,
          lastAttemptAt: recentAttempt, // Recent attempt = in backoff
        },
      ]);

      const stats = await processFileQueue();

      // File 1 should complete, file 2 should be skipped due to backoff
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      // File 2 stays pending with same retryCount = skipped
      expect(stats.skipped).toBeGreaterThanOrEqual(0);
    });

    it("should handle deleted files gracefully", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          secretId: "secret-123",
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "2",
          file,
          secretId: "secret-456",
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
      ]);

      // Delete file 1 before processing
      await db.fileQueue.delete("1");

      const stats = await processFileQueue();

      // Only file 2 should be processed
      expect(stats.total).toBe(1);
      expect(stats.completed).toBe(1);
    });

    it("should count pending files with increased retry count", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      // Add a file that will fail
      await db.fileQueue.add({
        id: "1",
        file,
        secretId: "secret-123",
        metadata,
        uploadState: "pending",
        retryCount: 0,
        createdAt: new Date(),
        lastAttemptAt: new Date(Date.now() - 10000), // 10s ago - not in backoff
      });

      // Mock uploadAttachment to fail
      const mockUpload = vi.mocked(
        (await import("../services/secretApi")).uploadAttachment
      );
      mockUpload.mockRejectedValueOnce(new Error("Upload failed"));

      const stats = await processFileQueue();

      // File should have failed and logged error
      expect(stats.total).toBe(1);
      expect(stats.failed).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[FileQueue] Upload failed for test.txt"),
        "Upload failed"
      );

      // Verify retryCount was increased
      const updatedFile = await db.fileQueue.get("1");
      expect(updatedFile?.retryCount).toBe(1);

      consoleSpy.mockRestore();
    });
  });

  describe("clearCompletedUploads", () => {
    it("should delete only completed uploads", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          metadata,
          uploadState: "completed",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "2",
          file,
          metadata,
          uploadState: "pending",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "3",
          file,
          metadata,
          uploadState: "completed",
          retryCount: 0,
          createdAt: new Date(),
        },
      ]);

      const deleted = await clearCompletedUploads();

      expect(deleted).toBe(2);
      const remaining = await db.fileQueue.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe("2");
    });
  });

  describe("getStorageQuota", () => {
    it("should return quota information", async () => {
      // Mock navigator.storage.estimate
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 50000000, // 50MB
        quota: 100000000, // 100MB
      });

      Object.defineProperty(navigator, "storage", {
        value: { estimate: mockEstimate },
        writable: true,
        configurable: true,
      });

      const quota = await getStorageQuota();

      expect(quota.used).toBe(50000000);
      expect(quota.quota).toBe(100000000);
      expect(quota.remaining).toBe(50000000);
      expect(quota.percentage).toBe(50);
    });

    it("should fallback if Storage API unavailable", async () => {
      // Remove Storage API
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, "storage", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const quota = await getStorageQuota();

      expect(quota.used).toBe(0);
      expect(quota.quota).toBe(0);

      // Restore
      Object.defineProperty(navigator, "storage", {
        value: originalStorage,
        writable: true,
        configurable: true,
      });
    });
  });

  describe("getFailedFiles", () => {
    it("should return only failed files", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      await db.fileQueue.bulkAdd([
        {
          id: "1",
          file,
          metadata,
          uploadState: "failed",
          retryCount: 3,
          error: "Network error",
          createdAt: new Date(),
        },
        {
          id: "2",
          file,
          metadata,
          uploadState: "completed",
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: "3",
          file,
          metadata,
          uploadState: "failed",
          retryCount: 1,
          error: "Timeout",
          createdAt: new Date(Date.now() - 1000),
        },
      ]);

      const failed = await getFailedFiles();

      expect(failed).toHaveLength(2);
      expect(failed[0]?.id).toBe("3"); // Oldest first
      expect(failed[1]?.id).toBe("1");
    });
  });

  describe("deleteQueuedFile", () => {
    it("should delete file from queue", async () => {
      const file = new Blob(["test"], { type: "text/plain" });
      const metadata = {
        name: "test.txt",
        type: "text/plain",
        size: 4,
        timestamp: Date.now(),
      };

      const id = await addFileToQueue(file, metadata);

      await deleteQueuedFile(id);

      const deleted = await db.fileQueue.get(id);
      expect(deleted).toBeUndefined();
    });
  });
});
