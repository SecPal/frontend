// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import type { SyncOperation } from "./db";
import { getAuthHeaders } from "../config";

/**
 * Cache an API response in IndexedDB
 *
 * @param url - API endpoint URL
 * @param data - Response data to cache
 * @param ttl - Time to live in milliseconds (default: 24 hours)
 *
 * @example
 * ```ts
 * const response = await fetch('/api/v1/guards');
 * const guards = await response.json();
 * await cacheApiResponse('/api/v1/guards', guards);
 * ```
 */
export async function cacheApiResponse(
  url: string,
  data: unknown,
  ttl: number = 24 * 60 * 60 * 1000 // 24 hours
): Promise<void> {
  const now = new Date();
  await db.apiCache.put({
    url,
    data,
    cachedAt: now,
    expiresAt: new Date(now.getTime() + ttl),
  });
}

/**
 * Get cached API response from IndexedDB
 *
 * @param url - API endpoint URL
 * @returns Cached data or null if not found or expired
 *
 * @example
 * ```ts
 * const cachedGuards = await getCachedResponse('/api/v1/guards');
 * if (cachedGuards) {
 *   // Use cached data
 * } else {
 *   // Fetch from API
 * }
 * ```
 */
export async function getCachedResponse(url: string): Promise<unknown | null> {
  const cached = await db.apiCache.get(url);

  if (!cached) {
    return null;
  }

  // Check if expired
  if (cached.expiresAt < new Date()) {
    // Delete expired entry
    await db.apiCache.delete(url);
    return null;
  }

  return cached.data;
}

/**
 * Add an operation to the sync queue
 *
 * @param operation - Operation to queue
 * @returns ID of the queued operation
 *
 * @example
 * ```ts
 * await addToSyncQueue({
 *   type: 'create',
 *   entity: 'guard',
 *   data: { name: 'John Doe', email: 'john@secpal.dev' }
 * });
 * ```
 */
export async function addToSyncQueue(operation: {
  type: SyncOperation["type"];
  entity: string;
  data: unknown;
}): Promise<string> {
  const id = crypto.randomUUID();

  await db.syncQueue.add({
    id,
    type: operation.type,
    entity: operation.entity,
    data: operation.data,
    status: "pending",
    createdAt: new Date(),
    attempts: 0,
  });

  return id;
}

/**
 * Get all pending sync operations
 *
 * @returns Array of pending operations, ordered by createdAt (oldest first)
 *
 * @example
 * ```ts
 * const pending = await getPendingSyncOperations();
 * for (const op of pending) {
 *   await syncOperation(op);
 * }
 * ```
 */
export async function getPendingSyncOperations(): Promise<SyncOperation[]> {
  return db.syncQueue.where("status").equals("pending").sortBy("createdAt");
}

/**
 * Check storage quota usage
 *
 * @returns Storage usage info or null if API not available
 *
 * @example
 * ```ts
 * const quota = await checkStorageQuota();
 * if (quota && quota.percentUsed > 80) {
 *   console.warn('Storage almost full!');
 * }
 * ```
 */
export async function checkStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentUsed: number;
} | null> {
  if ("storage" in navigator && "estimate" in navigator.storage) {
    const { usage, quota } = await navigator.storage.estimate();
    return {
      usage: usage || 0,
      quota: quota || 0,
      percentUsed: quota ? ((usage || 0) / quota) * 100 : 0,
    };
  }
  return null;
}

/**
 * Clean expired cache entries
 *
 * @returns Number of deleted entries
 *
 * @example
 * ```ts
 * const deleted = await cleanExpiredCache();
 * console.log(`Cleaned ${deleted} expired cache entries`);
 * ```
 */
export async function cleanExpiredCache(): Promise<number> {
  const now = new Date();
  return db.apiCache.where("expiresAt").below(now).delete();
}

/**
 * Update the status of a sync operation
 *
 * @param id - Operation ID
 * @param status - New status
 * @param error - Optional error message
 *
 * @example
 * ```ts
 * await updateSyncOperationStatus('abc-123', 'synced');
 * await updateSyncOperationStatus('def-456', 'error', 'Network timeout');
 * ```
 */
export async function updateSyncOperationStatus(
  id: string,
  status: SyncOperation["status"],
  error?: string
): Promise<void> {
  const operation = await db.syncQueue.get(id);
  if (!operation) {
    throw new Error(`Sync operation ${id} not found`);
  }

  await db.syncQueue.update(id, {
    status,
    error,
    lastAttemptAt: new Date(),
    attempts: operation.attempts + 1,
  });
}

/**
 * Retry a single sync operation with exponential backoff
 *
 * @param operation - Operation to retry
 * @param apiBaseUrl - Base URL for API requests
 * @returns Success status
 *
 * @example
 * ```ts
 * const operation = await db.syncQueue.get('abc-123');
 * if (operation) {
 *   const success = await retrySyncOperation(operation, 'https://api.secpal.dev');
 * }
 * ```
 */
export async function retrySyncOperation(
  operation: SyncOperation,
  apiBaseUrl: string
): Promise<boolean> {
  // Max retry attempts: 5
  if (operation.attempts >= 5) {
    await updateSyncOperationStatus(
      operation.id,
      "error",
      "Max retry attempts reached"
    );
    return false;
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s
  const backoffDelay = Math.pow(2, operation.attempts) * 1000;
  if (operation.lastAttemptAt) {
    const timeSinceLastAttempt = Date.now() - operation.lastAttemptAt.getTime();
    if (timeSinceLastAttempt < backoffDelay) {
      // Too soon to retry
      return false;
    }
  }

  try {
    const endpoint = `${apiBaseUrl}/${operation.entity}`;
    const authHeaders = getAuthHeaders();
    let response: Response;

    switch (operation.type) {
      case "create":
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(operation.data),
        });
        break;

      case "update":
        response = await fetch(endpoint, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify(operation.data),
        });
        break;

      case "delete":
        response = await fetch(endpoint, {
          method: "DELETE",
          headers: authHeaders,
        });
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    if (response.ok) {
      await updateSyncOperationStatus(operation.id, "synced");
      return true;
    } else {
      const errorText = await response.text();
      await updateSyncOperationStatus(
        operation.id,
        "error",
        `HTTP ${response.status}: ${errorText}`
      );
      return false;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await updateSyncOperationStatus(
      operation.id,
      operation.attempts >= 4 ? "error" : "pending",
      errorMessage
    );
    return false;
  }
}

/**
 * Process all pending sync operations
 *
 * @param apiBaseUrl - Base URL for API requests
 * @returns Statistics about processed operations
 *
 * @example
 * ```ts
 * const stats = await processSyncQueue('https://api.secpal.dev');
 * console.log(`Synced: ${stats.synced}, Failed: ${stats.failed}`);
 * ```
 */
export async function processSyncQueue(apiBaseUrl: string): Promise<{
  total: number;
  synced: number;
  failed: number;
  pending: number;
}> {
  const operations = await getPendingSyncOperations();
  let synced = 0;
  let failed = 0;
  let pending = 0;

  for (const operation of operations) {
    const success = await retrySyncOperation(operation, apiBaseUrl);
    if (success) {
      synced++;
    } else {
      const updatedOp = await db.syncQueue.get(operation.id);
      if (updatedOp?.status === "error") {
        failed++;
      } else {
        pending++;
      }
    }
  }

  return {
    total: operations.length,
    synced,
    failed,
    pending,
  };
}

/**
 * Clear all completed (synced) sync operations
 *
 * @returns Number of deleted operations
 *
 * @example
 * ```ts
 * const deleted = await clearCompletedSyncOperations();
 * console.log(`Cleared ${deleted} completed operations`);
 * ```
 */
export async function clearCompletedSyncOperations(): Promise<number> {
  return db.syncQueue.where("status").equals("synced").delete();
}
