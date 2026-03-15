// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Shared database constants
 *
 * IMPORTANT: These constants are used in both main app and Service Worker contexts.
 * The Service Worker cannot import from lib/db.ts due to module resolution limitations,
 * so we extract shared constants here.
 */

/**
 * Database name - must match across all contexts
 */
export const DB_NAME = "SecPalDB";

/**
 * Database schema version - must match db.ts schema version
 *
 * Source of truth: This constant
 * Used in: src/lib/db.ts (db.version(DB_VERSION))
 *
 * When incrementing:
 * 1. Update this constant
 * 2. Update the single version() block in db.ts
 */
export const DB_VERSION = 8;
