// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import Dexie, { type EntityTable } from "dexie";
import { DB_NAME } from "./db-constants";

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
 * Organizational unit cache entry stored in IndexedDB
 * Mirrors OrganizationalUnit from types/organizational.ts but adds offline-specific fields
 */
export interface OrganizationalUnitCacheEntry {
  id: string;
  type:
    | "holding"
    | "company"
    | "region"
    | "branch"
    | "division"
    | "department"
    | "custom";
  name: string;
  custom_type_name?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  parent_id?: string | null;
  parent?: {
    id: string;
    type: string;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
  // Offline-specific fields
  cachedAt: Date;
  lastSynced: Date;
  pendingSync?: boolean; // True if local changes haven't been synced
}

/**
 * SecPal IndexedDB database
 *
 * Provides offline-first storage for:
 * - Guards (employees)
 * - Sync queue (operations to sync when online)
 * - API cache (cached responses for offline access)
 * - Analytics (offline event tracking)
 * - Organizational unit cache (offline organizational structure)
 */
export const db = new Dexie(DB_NAME) as Dexie & {
  guards: EntityTable<Guard, "id">;
  syncQueue: EntityTable<SyncOperation, "id">;
  apiCache: EntityTable<ApiCacheEntry, "url">;
  analytics: EntityTable<AnalyticsEvent, "id">;
  organizationalUnitCache: EntityTable<OrganizationalUnitCacheEntry, "id">;
};

// Schema version 1
db.version(1).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
});

// Schema version 2 - Add analytics table
// Note: Per Dexie.js best practices, all existing tables must be re-declared
// when upgrading schema versions, even if they haven't changed
db.version(2).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
});

// Schema version 3 - Add fileQueue table
db.version(3).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
  fileQueue: "id, uploadState, createdAt, retryCount",
});

// Schema version 4 - Add secretCache table
db.version(4).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
  fileQueue: "id, uploadState, createdAt, retryCount",
  secretCache: "id, updated_at, cachedAt, pendingSync, *tags",
});

// Schema version 5 - Add organizationalUnitCache table
db.version(5).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
  fileQueue: "id, uploadState, createdAt, retryCount",
  secretCache: "id, updated_at, cachedAt, pendingSync, *tags",
  organizationalUnitCache:
    "id, type, parent_id, updated_at, cachedAt, pendingSync",
});

// Schema version 6 - Remove Secrets-specific offline storage
db.version(6).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, entity, status, createdAt, attempts",
  apiCache: "url, expiresAt",
  analytics: "++id, synced, timestamp, sessionId, type",
  organizationalUnitCache:
    "id, type, parent_id, updated_at, cachedAt, pendingSync",
});
