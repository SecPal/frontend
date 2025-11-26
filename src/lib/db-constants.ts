// SPDX-FileCopyrightText: 2025 SecPal
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
 * Used in: src/lib/db.ts, src/sw.ts
 *
 * When incrementing:
 * 1. Update this constant
 * 2. Add new version() block in db.ts
 * 3. Service Worker will automatically use new version
 */
export const DB_VERSION = 4;

/**
 * Maximum retry attempts for file uploads before marking as permanently failed
 */
export const MAX_RETRY_COUNT = 5;

/**
 * Maximum backoff delay in milliseconds (60 seconds)
 */
export const MAX_BACKOFF_MS = 60000;

/**
 * Concurrency limit for parallel file uploads
 */
export const UPLOAD_CONCURRENCY = 3;
