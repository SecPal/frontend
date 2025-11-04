// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from './db';
import type { SyncOperation } from './db';

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
 *   data: { name: 'John Doe', email: 'john@secpal.app' }
 * });
 * ```
 */
export async function addToSyncQueue(operation: {
  type: SyncOperation['type'];
  entity: string;
  data: unknown;
}): Promise<string> {
  const id = crypto.randomUUID();

  await db.syncQueue.add({
    id,
    type: operation.type,
    entity: operation.entity,
    data: operation.data,
    status: 'pending',
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
  return db.syncQueue
    .where('status')
    .equals('pending')
    .sortBy('createdAt');
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
  if ('storage' in navigator && 'estimate' in navigator.storage) {
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
  return db.apiCache.where('expiresAt').below(now).delete();
}
