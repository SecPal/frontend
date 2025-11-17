// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import type { FileQueueEntry, FileMetadata } from "./db";
import {
  MAX_RETRY_COUNT,
  MAX_BACKOFF_MS,
  UPLOAD_CONCURRENCY,
} from "./db-constants";

/**
 * Add a file to the upload queue
 *
 * @param file - File Blob to upload
 * @param metadata - File metadata (name, type, size, timestamp)
 * @param secretId - Optional target Secret ID
 * @returns ID of the queued file
 *
 * @example
 * ```ts
 * const id = await addFileToQueue(fileBlob, {
 *   name: 'document.pdf',
 *   type: 'application/pdf',
 *   size: 1024000,
 *   timestamp: Date.now()
 * });
 * ```
 */
export async function addFileToQueue(
  file: Blob,
  metadata: FileMetadata,
  secretId?: string
): Promise<string> {
  const id = crypto.randomUUID();

  await db.fileQueue.add({
    id,
    file,
    metadata,
    uploadState: "pending",
    secretId,
    retryCount: 0,
    createdAt: new Date(),
  });

  return id;
}

/**
 * Get all pending files in the queue
 *
 * @returns Array of pending file entries, ordered by createdAt (oldest first)
 *
 * @example
 * ```ts
 * const pending = await getPendingFiles();
 * for (const file of pending) {
 *   await uploadFile(file);
 * }
 * ```
 */
export async function getPendingFiles(): Promise<FileQueueEntry[]> {
  return db.fileQueue
    .where("uploadState")
    .equals("pending")
    .sortBy("createdAt");
}

/**
 * Get all files in the queue (any state)
 *
 * @returns Array of all file entries, ordered by createdAt (newest first)
 *
 * @example
 * ```ts
 * const allFiles = await getAllQueuedFiles();
 * console.log(`Queue has ${allFiles.length} files`);
 * ```
 */
export async function getAllQueuedFiles(): Promise<FileQueueEntry[]> {
  return db.fileQueue.reverse().sortBy("createdAt");
}

/**
 * Update the upload state of a file
 *
 * @param id - File queue entry ID
 * @param uploadState - New upload state
 * @param error - Optional error message
 *
 * @example
 * ```ts
 * await updateFileUploadState('abc-123', 'completed');
 * await updateFileUploadState('def-456', 'failed', 'Network timeout');
 * ```
 */
export async function updateFileUploadState(
  id: string,
  uploadState: FileQueueEntry["uploadState"],
  error?: string
): Promise<void> {
  const entry = await db.fileQueue.get(id);
  if (!entry) {
    throw new Error(`File queue entry ${id} not found`);
  }

  await db.fileQueue.update(id, {
    uploadState,
    error,
    lastAttemptAt: new Date(),
    retryCount:
      uploadState === "failed" ? entry.retryCount + 1 : entry.retryCount,
  });
}

/**
 * Retry a failed file upload
 *
 * @param entry - File queue entry to retry
 * @param apiBaseUrl - Base URL for API requests
 * @returns true if upload succeeded, false otherwise
 *
 * @example
 * ```ts
 * const failedFiles = await getFailedFiles();
 * for (const file of failedFiles) {
 *   await retryFileUpload(file, 'https://api.secpal.dev');
 * }
 * ```
 */
export async function retryFileUpload(
  entry: FileQueueEntry,
  apiBaseUrl: string
): Promise<boolean> {
  if (entry.retryCount >= MAX_RETRY_COUNT) {
    await updateFileUploadState(entry.id, "failed", "Max retries exceeded");
    return false;
  }

  // Exponential backoff: 2^retryCount seconds, capped at MAX_BACKOFF_MS (60s)
  // Retry 0 (first retry): 1s, Retry 1: 2s, Retry 2: 4s, Retry 3: 8s, Retry 4: 16s
  // Retry 5+: 32s, 60s (capped), 60s (capped), ...
  // Skip backoff check on very first upload attempt (lastAttemptAt not set yet)
  if (entry.lastAttemptAt) {
    const backoffMs = Math.min(
      Math.pow(2, entry.retryCount) * 1000,
      MAX_BACKOFF_MS
    );
    const timeSinceLastAttempt = Date.now() - entry.lastAttemptAt.getTime();

    if (timeSinceLastAttempt < backoffMs) {
      return false; // Too soon to retry
    }
  }

  try {
    await updateFileUploadState(entry.id, "uploading");

    // TODO: Implement actual file upload logic when Secret API is ready
    // For now, just log the placeholder and mark as completed
    console.log(
      `[FileQueue] Would upload to ${apiBaseUrl}/api/v1/secrets/${entry.secretId || "new"}/files`,
      {
        name: entry.metadata.name,
        size: entry.metadata.size,
      }
    );

    // Placeholder: In real implementation, we would:
    // const formData = new FormData();
    // formData.append("file", entry.file, entry.metadata.name);
    // if (entry.secretId) formData.append("secret_id", entry.secretId);
    // const response = await fetch(`${apiBaseUrl}/api/v1/secrets/${entry.secretId}/files`, {
    //   method: 'POST',
    //   body: formData
    // });

    // Mark as completed (placeholder until real API is integrated)
    await updateFileUploadState(entry.id, "completed");
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Upload failed";
    await updateFileUploadState(entry.id, "failed", errorMsg);
    return false;
  }
}

/**
 * Process files with concurrency limit using worker pool pattern
 *
 * This implementation uses a worker pool to avoid race conditions and
 * maintain strict concurrency limits.
 *
 * @param items - Items to process
 * @param worker - Async worker function for each item
 * @param concurrency - Maximum parallel operations
 */
async function processWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function workerLoop(): Promise<void> {
    while (true) {
      const currentIndex = index++;
      if (currentIndex >= items.length) {
        break;
      }
      const item = items[currentIndex];
      if (item === undefined) {
        throw new Error(`Invalid array index: ${currentIndex}`);
      }
      results[currentIndex] = await worker(item);
    }
  }

  // Create worker pool with specified concurrency
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => workerLoop()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Process all pending files in the queue
 *
 * @param apiBaseUrl - Base URL for API requests
 * @param concurrency - Maximum parallel uploads (default: UPLOAD_CONCURRENCY constant)
 * @returns Statistics about processed files
 *
 * @example
 * ```ts
 * const stats = await processFileQueue('https://api.secpal.dev');
 * console.log(`Uploaded: ${stats.completed}, Failed: ${stats.failed}`);
 * ```
 */
export async function processFileQueue(
  apiBaseUrl: string,
  concurrency = UPLOAD_CONCURRENCY
): Promise<{
  total: number;
  completed: number;
  failed: number;
  pending: number;
  skipped: number;
}> {
  const files = await getPendingFiles();

  // Process files in parallel with concurrency limit
  const results = await processWithConcurrency(
    files,
    async (file) => {
      const success = await retryFileUpload(file, apiBaseUrl);
      if (success) {
        return { status: "completed" as const, file };
      } else {
        // Check updated state to distinguish between failed and skipped (backoff)
        const updatedFile = await db.fileQueue.get(file.id);
        if (updatedFile?.uploadState === "failed") {
          return { status: "failed" as const, file };
        } else if (updatedFile?.uploadState === "uploading") {
          // Should not happen, but handle gracefully
          return { status: "pending" as const, file };
        } else {
          // Still pending - likely skipped due to backoff
          return { status: "skipped" as const, file };
        }
      }
    },
    concurrency
  );

  // Count results
  let completed = 0;
  let failed = 0;
  let pending = 0;
  let skipped = 0;

  for (const result of results) {
    if (result.status === "completed") completed++;
    else if (result.status === "failed") failed++;
    else if (result.status === "pending") pending++;
    else if (result.status === "skipped") skipped++;
  }

  return {
    total: files.length,
    completed,
    failed,
    pending,
    skipped,
  };
}

/**
 * Clear all completed file uploads from queue
 *
 * @returns Number of deleted entries
 *
 * @example
 * ```ts
 * const deleted = await clearCompletedUploads();
 * console.log(`Cleared ${deleted} completed uploads`);
 * ```
 */
export async function clearCompletedUploads(): Promise<number> {
  return db.fileQueue.where("uploadState").equals("completed").delete();
}

/**
 * Get storage quota information
 *
 * @returns Quota information (used, remaining, percentage)
 *
 * @example
 * ```ts
 * const quota = await getStorageQuota();
 * if (quota.percentage > 90) {
 *   console.warn('Storage almost full!');
 * }
 * ```
 */
export async function getStorageQuota(): Promise<{
  used: number;
  remaining: number;
  quota: number;
  percentage: number;
}> {
  if (!navigator.storage?.estimate) {
    // Fallback for browsers without Storage API
    return {
      used: 0,
      remaining: 0,
      quota: 0,
      percentage: 0,
    };
  }

  const estimate = await navigator.storage.estimate();
  const used = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  const remaining = quota - used;
  const percentage = quota > 0 ? (used / quota) * 100 : 0;

  return {
    used,
    remaining,
    quota,
    percentage,
  };
}

/**
 * Get all failed file uploads
 *
 * @returns Array of failed file entries
 *
 * @example
 * ```ts
 * const failed = await getFailedFiles();
 * for (const file of failed) {
 *   console.error(`Failed upload: ${file.metadata.name}`, file.error);
 * }
 * ```
 */
export async function getFailedFiles(): Promise<FileQueueEntry[]> {
  return db.fileQueue.where("uploadState").equals("failed").sortBy("createdAt");
}

/**
 * Delete a file from the queue
 *
 * @param id - File queue entry ID
 *
 * @example
 * ```ts
 * await deleteQueuedFile('abc-123');
 * ```
 */
export async function deleteQueuedFile(id: string): Promise<void> {
  await db.fileQueue.delete(id);
}
