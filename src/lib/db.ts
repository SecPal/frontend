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
  status: "pending" | "failed" | "completed";
  createdAt: Date;
  attempts: number;
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

/**
 * SecPal IndexedDB database
 *
 * Provides offline-first storage for:
 * - Guards (employees)
 * - Sync queue (operations to sync when online)
 * - API cache (cached responses for offline access)
 */
export const db = new Dexie("SecPalDB") as Dexie & {
  guards: EntityTable<Guard, "id">;
  syncQueue: EntityTable<SyncOperation, "id">;
  apiCache: EntityTable<ApiCacheEntry, "url">;
};

// Schema version 1
db.version(1).stores({
  guards: "id, email, lastSynced",
  syncQueue: "id, status, createdAt, attempts",
  apiCache: "url, expiresAt",
});
