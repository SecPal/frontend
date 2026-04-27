// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import Dexie, { type EntityTable } from "dexie";
import { DB_NAME, DB_VERSION } from "./db-constants";

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
}

export interface EncryptedVaultRecord {
  recordId: string;
  version: number;
  ciphertext: string;
  iv: string;
  authTag: string;
}

export interface EncryptedProfileRecord extends EncryptedVaultRecord {
  id: "profile";
}

export interface VaultAnalyticsRecord extends EncryptedVaultRecord {
  id?: number;
  synced: boolean;
  timestamp: number;
}

export interface VaultOrganizationalUnitCacheRecord extends EncryptedVaultRecord {
  id: string;
  type?: OrganizationalUnitCacheEntry["type"];
  parent_id?: string | null;
  parentLookupKey?: string;
  cachedAt: Date;
  lastSynced: Date;
}

/**
 * SecPal IndexedDB database
 *
 * Provides offline-first storage for:
 * - Analytics (offline event tracking)
 * - Organizational unit cache (offline organizational structure)
 */
export const db = new Dexie(DB_NAME) as Dexie & {
  analytics: EntityTable<AnalyticsEvent, "id">;
  organizationalUnitCache: EntityTable<OrganizationalUnitCacheEntry, "id">;
  vaultProfile: EntityTable<EncryptedProfileRecord, "id">;
  vaultAnalytics: EntityTable<VaultAnalyticsRecord, "id">;
  vaultOrganizationalUnitCache: EntityTable<
    VaultOrganizationalUnitCacheRecord,
    "id"
  >;
};

// Schema version 11 - Adds encrypted vault-backed offline stores for long-term PII.
db.version(11).stores({
  analytics: "++id, synced, timestamp, sessionId, type",
  organizationalUnitCache: "id, type, parent_id, updated_at, cachedAt",
  vaultProfile: "id",
  vaultAnalytics: "++id, synced, timestamp",
  vaultOrganizationalUnitCache: "id, cachedAt, lastSynced",
});

// Schema version 12 - Restores indexed vault organizational-unit lookups.
// 0.x keeps the IndexedDB schema focused on the currently supported offline data.
db.version(DB_VERSION).stores({
  analytics: "++id, synced, timestamp, sessionId, type",
  organizationalUnitCache: "id, type, parent_id, updated_at, cachedAt",
  vaultProfile: "id",
  vaultAnalytics: "++id, synced, timestamp",
  vaultOrganizationalUnitCache: "id, type, parentLookupKey, parent_id, cachedAt, lastSynced",
});
