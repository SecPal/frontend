// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import type { SyncOperation } from "./db";
import {
  createSecret,
  updateSecret,
  deleteSecret as deleteSecretApi,
} from "../services/secretApi";
import { MAX_RETRY_COUNT, MAX_BACKOFF_MS } from "./db-constants";

/**
 * Secret operation data types
 */
export type SecretOperationData =
  | {
      id?: string;
      title: string;
      username?: string;
      password?: string;
      url?: string;
      notes?: string;
      tags?: string[];
      expires_at?: string;
    }
  | { id: string; [key: string]: unknown };

/**
 * Sync queue processing result
 */
export interface SyncQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Add a secret operation to the sync queue
 *
 * @param type - Operation type (create, update, delete)
 * @param data - Secret data
 * @returns ID of the queued operation
 *
 * @example
 * ```ts
 * const id = await addSecretOperation('create', {
 *   title: 'Gmail Account',
 *   username: 'user@example.com',
 *   password: 'secret123',
 * });
 * ```
 */
export async function addSecretOperation(
  type: "create" | "update" | "delete",
  data: SecretOperationData
): Promise<string> {
  const id = crypto.randomUUID();

  const operation: SyncOperation = {
    id,
    type,
    entity: "secret",
    data,
    status: "pending",
    createdAt: new Date(),
    attempts: 0,
  };

  await db.syncQueue.add(operation);

  return id;
}

/**
 * Get all pending secret operations
 *
 * @returns Array of pending operations sorted by createdAt (oldest first)
 *
 * @example
 * ```ts
 * const pending = await getPendingSecretOperations();
 * console.log(`${pending.length} operations pending`);
 * ```
 */
export async function getPendingSecretOperations(): Promise<SyncOperation[]> {
  return db.syncQueue
    .where("entity")
    .equals("secret")
    .and((op) => op.status === "pending")
    .sortBy("createdAt");
}

/**
 * Update operation status
 *
 * @param id - Operation ID
 * @param status - New status
 * @param error - Optional error message
 *
 * @example
 * ```ts
 * await updateSecretOperationStatus('op-1', 'synced');
 * await updateSecretOperationStatus('op-2', 'error', 'Network timeout');
 * ```
 */
export async function updateSecretOperationStatus(
  id: string,
  status: "pending" | "synced" | "error",
  error?: string
): Promise<void> {
  const operation = await db.syncQueue.get(id);
  if (!operation) return;

  const updates: Partial<SyncOperation> = {
    status,
    error,
  };

  if (status === "error") {
    updates.attempts = operation.attempts + 1;
    updates.lastAttemptAt = new Date();
  } else if (status === "pending") {
    // Clear lastAttemptAt when resetting to pending to skip backoff wait
    updates.lastAttemptAt = undefined;
  }

  await db.syncQueue.update(id, updates);
}

/**
 * Calculate exponential backoff delay in milliseconds
 *
 * @param attempts - Number of previous attempts
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempts: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at MAX_BACKOFF_MS (30s)
  const baseDelay = 1000; // 1 second
  const delay = baseDelay * Math.pow(2, attempts);
  return Math.min(delay, MAX_BACKOFF_MS);
}

/**
 * Check if operation is ready for retry based on backoff
 *
 * @param operation - Sync operation
 * @returns True if ready to retry
 */
function isReadyForRetry(operation: SyncOperation): boolean {
  if (operation.attempts >= MAX_RETRY_COUNT) {
    return false; // Max retries exceeded
  }

  if (!operation.lastAttemptAt) {
    return true; // First attempt
  }

  const backoffMs = calculateBackoff(operation.attempts);
  const timeSinceLastAttempt = Date.now() - operation.lastAttemptAt.getTime();

  return timeSinceLastAttempt >= backoffMs;
}

/**
 * Process a single secret operation
 *
 * @param operation - Sync operation to process
 * @returns True if successful, false otherwise
 */
async function processSecretOperation(
  operation: SyncOperation
): Promise<boolean> {
  try {
    const data = operation.data as SecretOperationData;

    switch (operation.type) {
      case "create":
        await createSecret(
          data as Exclude<SecretOperationData, { id: string }>
        );
        break;

      case "update":
        if (!("id" in data) || !data.id) {
          throw new Error("Update operation requires secret ID");
        }
        // Cast to UpdateSecretRequest (excluding id and type fields if present)
        await updateSecret(data.id, data as Record<string, unknown>);
        break;

      case "delete":
        if (!("id" in data) || !data.id) {
          throw new Error("Delete operation requires secret ID");
        }
        await deleteSecretApi(data.id);
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    await updateSecretOperationStatus(operation.id, "synced");
    return true;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await updateSecretOperationStatus(operation.id, "error", errorMsg);
    return false;
  }
}

/**
 * Process all pending secret operations in the sync queue
 *
 * Implements exponential backoff retry logic for failed operations.
 *
 * @returns Statistics about processed operations
 *
 * @example
 * ```ts
 * const result = await processSecretSyncQueue();
 * console.log(`Processed: ${result.processed}, Succeeded: ${result.succeeded}, Failed: ${result.failed}`);
 * ```
 */
export async function processSecretSyncQueue(): Promise<SyncQueueResult> {
  const pending = await getPendingSecretOperations();

  // Filter operations that are ready for retry
  const readyOperations = pending.filter(isReadyForRetry);

  let succeeded = 0;
  let failed = 0;

  for (const operation of readyOperations) {
    const success = await processSecretOperation(operation);
    if (success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  return {
    processed: readyOperations.length,
    succeeded,
    failed,
  };
}

/**
 * Clear completed (synced) secret operations from the queue
 *
 * Useful for cleanup after successful sync
 *
 * @example
 * ```ts
 * await clearCompletedSecretOperations();
 * console.log('Completed operations cleared');
 * ```
 */
export async function clearCompletedSecretOperations(): Promise<void> {
  await db.syncQueue
    .where("entity")
    .equals("secret")
    .and((op) => op.status === "synced")
    .delete();
}
