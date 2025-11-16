// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import Dexie, { type EntityTable } from "dexie";

/**
 * Guard entity stored in IndexedDB
 */
export interface Guard {
  id: string;
  name: string;
  email: string;
  lastSynced: Date;
}

/**
 * Sync operation for offline queue
 */
export interface SyncOperation {
  id: string;
  type: "create" | "update" | "delete";
  entity: string;
  data: unknown;
  status: "pending" | "synced" | "error";
  createdAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
}

/**
 * API response cache entry
 */
export interface ApiCacheEntry {
  url: string;
  data: unknown;
  cachedAt: Date;
  expiresAt: Date;
}

export type AnalyticsEventType =
  | "page_view"
  | "button_click"
  | "form_submit"
  | "error"
  | "performance"
  | "feature_usage";

/**
 * Analytics event for offline tracking
 */
export interface AnalyticsEvent {
  id?: number;
  type: AnalyticsEventType;
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
  sessionId: string;
  userId?: string;
}

/**
 * File metadata for file queue entries
 */
export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  timestamp: number;
}

/**
 * File queue entry for offline file uploads
 * Stores files in IndexedDB for persistent offline queue
 */
export interface FileQueueEntry {
  id: string; // UUID
  file: Blob; // Actual file data
  metadata: FileMetadata;
  uploadState: "pending" | "uploading" | "failed" | "completed";
  secretId?: string; // Target Secret (if known)
  retryCount: number;
  error?: string;
  createdAt: Date;
  lastAttemptAt?: Date;
}

/**
 * SecPal IndexedDB database
 *
 * Provides offline-first storage for:
 * - Guards (employees)
 * - Sync queue (operations to sync when online)
 * - API cache (cached responses for offline access)
 * - Analytics (offline event tracking)
 * - File queue (offline file upload queue)
 */
export const db = new Dexie("SecPalDB") as Dexie & {
  guards: EntityTable<Guard, "id">;
  syncQueue: EntityTable<SyncOperation, "id">;
  apiCache: EntityTable<ApiCacheEntry, "url">;
  analytics: EntityTable<AnalyticsEvent, "id">;
  fileQueue: EntityTable<FileQueueEntry, "id">;
};

// Schema version 1
db.version(1).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, status, createdAt, attempts",
  apiCache: "url, expiresAt",
});

// Schema version 2 - Add analytics table
// Note: Per Dexie.js best practices, all existing tables must be re-declared
// when upgrading schema versions, even if they haven't changed
db.version(2).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
});

// Schema version 3 - Add fileQueue table
db.version(3).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
  fileQueue: "id, uploadState, createdAt, retryCount",
});
