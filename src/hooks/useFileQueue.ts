// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getPendingFiles,
  getFailedFiles,
  getAllQueuedFiles,
  processFileQueue,
  clearCompletedUploads,
  deleteQueuedFile,
  getStorageQuota,
} from "../lib/fileQueue";

/**
 * Hook for managing the file upload queue
 *
 * Provides real-time access to queued files and queue operations
 *
 * @param options - Configuration options
 * @param options.quotaUpdateInterval - Interval in ms for quota updates (default: 30000ms/30s)
 *
 * @example
 * ```tsx
 * const { pending, failed, quota, processQueue } = useFileQueue();
 *
 * return (
 *   <div>
 *     <p>{pending.length} files pending upload</p>
 *     <button onClick={() => processQueue('https://api.secpal.dev')}>
 *       Upload Now
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useFileQueue(options?: { quotaUpdateInterval?: number }) {
  const { quotaUpdateInterval = 30000 } = options || {};

  const [isProcessing, setIsProcessing] = useState(false);
  const [quota, setQuota] = useState<{
    used: number;
    remaining: number;
    quota: number;
    percentage: number;
  } | null>(null);

  // Real-time queries using Dexie React Hooks
  const allFiles = useLiveQuery(() => getAllQueuedFiles(), []);
  const pending = useLiveQuery(() => getPendingFiles(), []);
  const failed = useLiveQuery(() => getFailedFiles(), []);

  // Update quota periodically
  useEffect(() => {
    const updateQuota = async () => {
      const quotaInfo = await getStorageQuota();
      setQuota(quotaInfo);
    };

    updateQuota();

    // Update quota at configured interval
    const interval = setInterval(updateQuota, quotaUpdateInterval);

    return () => clearInterval(interval);
  }, [quotaUpdateInterval]);

  /**
   * Process all pending files in the queue
   */
  const processQueue = useCallback(async (apiBaseUrl: string) => {
    setIsProcessing(true);
    try {
      const stats = await processFileQueue(apiBaseUrl);
      return stats;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /**
   * Clear all completed uploads from queue
   */
  const clearCompleted = useCallback(async () => {
    const deleted = await clearCompletedUploads();
    return deleted;
  }, []);

  /**
   * Delete a specific file from queue
   */
  const deleteFile = useCallback(async (id: string) => {
    await deleteQueuedFile(id);
  }, []);

  /**
   * Register for Background Sync (if supported)
   *
   * Validates sync API availability at both prototype and instance level
   * before attempting registration.
   */
  const registerBackgroundSync = useCallback(async () => {
    if (
      "serviceWorker" in navigator &&
      "sync" in ServiceWorkerRegistration.prototype
    ) {
      try {
        const registration = await navigator.serviceWorker.ready;

        // Runtime check: Verify sync property exists on registration instance
        // TypeScript doesn't have types for Background Sync API, so we use type assertion
        const regWithSync = registration as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };

        if (
          regWithSync.sync &&
          typeof regWithSync.sync.register === "function"
        ) {
          await regWithSync.sync.register("sync-file-queue");
          console.log("[FileQueue] Background sync registered");
        } else {
          console.warn(
            "[FileQueue] Background sync not available on registration"
          );
        }
      } catch (error) {
        console.error(
          "[FileQueue] Background sync registration failed:",
          error
        );
      }
    }
  }, []);

  /**
   * Listen for Background Sync completion messages
   *
   * Note: Handler is memoized with useCallback to prevent duplicate listeners
   * during hot module replacement in development.
   */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "FILE_QUEUE_SYNCED") {
          const { count, succeeded, failed } = event.data;

          if (failed && failed > 0) {
            console.warn(
              `[FileQueue] Background sync completed with errors: ${succeeded || 0} succeeded, ${failed} failed`
            );
          } else {
            console.log(
              `[FileQueue] Background sync completed successfully: ${count} files`
            );
          }
          // Files are automatically updated via useLiveQuery
        } else if (event.data?.type === "FILE_QUEUE_SYNC_ERROR") {
          console.error(
            `[FileQueue] Background sync failed:`,
            event.data.error
          );
        }
      };

      navigator.serviceWorker.addEventListener("message", handleMessage);

      return () => {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      };
    }
  }, []);

  return {
    // Queue state
    allFiles: allFiles ?? [],
    pending: pending ?? [],
    failed: failed ?? [],
    isProcessing,
    quota,

    // Queue operations
    processQueue,
    clearCompleted,
    deleteFile,
    registerBackgroundSync,
  };
}
