// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SecretDetail } from "../services/secretApi";

/**
 * Conflict information for a secret
 */
export interface SecretConflict {
  localVersion: Partial<SecretDetail> & { updated_at: string };
  serverVersion: SecretDetail;
  conflictFields: string[];
}

/**
 * Conflict resolution strategy
 */
export type ConflictResolution = "keep-local" | "keep-server" | "manual";

/**
 * Detect conflicts between local and server secret versions
 *
 * Conflict occurs when:
 * - Local updated_at is older than server updated_at
 * - Both versions have changes (not just timestamps)
 *
 * @param local - Local secret data from cache
 * @param server - Server secret data
 * @returns Conflict info if conflict detected, null otherwise
 *
 * @example
 * ```ts
 * const conflict = detectSecretConflict(localSecret, serverSecret);
 * if (conflict) {
 *   // Show conflict resolution dialog
 * }
 * ```
 */
export function detectSecretConflict(
  local: Partial<SecretDetail> & { updated_at: string },
  server: SecretDetail
): SecretConflict | null {
  // No conflict if timestamps match
  if (local.updated_at === server.updated_at) {
    return null;
  }

  // Parse timestamps
  const localDate = new Date(local.updated_at);
  const serverDate = new Date(server.updated_at);

  // No conflict if local is newer (local wins by default)
  if (localDate >= serverDate) {
    return null;
  }

  // Local is older - check if there are actual content differences
  const conflictFields = findConflictingFields(local, server);

  // No conflict if only timestamps differ
  if (conflictFields.length === 0) {
    return null;
  }

  return {
    localVersion: local,
    serverVersion: server,
    conflictFields,
  };
}

/**
 * Find fields that differ between local and server versions
 *
 * Compares relevant fields (title, username, password, url, notes, tags)
 * and returns list of fields with conflicts.
 *
 * @param local - Local secret data
 * @param server - Server secret data
 * @returns Array of field names with conflicts
 */
function findConflictingFields(
  local: Partial<SecretDetail>,
  server: SecretDetail
): string[] {
  const fields: (keyof SecretDetail)[] = [
    "title",
    "username",
    "password",
    "url",
    "notes",
    "tags",
  ];

  const conflicts: string[] = [];

  for (const field of fields) {
    const localValue = local[field];
    const serverValue = server[field];

    // Skip if local doesn't have this field (no local change)
    if (localValue === undefined) {
      continue;
    }

    // Compare values
    if (field === "tags") {
      // Special handling for arrays
      const localTags = (localValue as string[]) || [];
      const serverTags = (serverValue as string[]) || [];

      if (
        localTags.length !== serverTags.length ||
        !localTags.every((tag, i) => tag === serverTags[i])
      ) {
        conflicts.push(field);
      }
    } else {
      // String comparison
      if (localValue !== serverValue) {
        conflicts.push(field);
      }
    }
  }

  return conflicts;
}

/**
 * Resolve conflict using Last-Write-Wins (LWW) strategy
 *
 * Automatically chooses the version with the most recent timestamp.
 * This is the default strategy when user doesn't manually resolve.
 *
 * @param conflict - Conflict information
 * @returns Resolution strategy
 *
 * @example
 * ```ts
 * const resolution = resolveConflictLWW(conflict);
 * // resolution === "keep-server" (server is newer)
 * ```
 */
export function resolveConflictLWW(
  conflict: SecretConflict
): "keep-local" | "keep-server" {
  const localDate = new Date(conflict.localVersion.updated_at);
  const serverDate = new Date(conflict.serverVersion.updated_at);

  return localDate > serverDate ? "keep-local" : "keep-server";
}

/**
 * Apply conflict resolution to merge data
 *
 * @param local - Local secret data
 * @param server - Server secret data
 * @param resolution - Resolution strategy
 * @returns Merged secret data
 *
 * @example
 * ```ts
 * const merged = applyConflictResolution(local, server, "keep-server");
 * // Use merged data for update
 * ```
 */
export function applyConflictResolution(
  local: Partial<SecretDetail>,
  server: SecretDetail,
  resolution: "keep-local" | "keep-server"
): SecretDetail {
  if (resolution === "keep-server") {
    return server;
  }

  // Keep local changes, merge with server metadata
  return {
    ...server, // Server version as base (includes metadata)
    ...local, // Override with local changes
    updated_at: server.updated_at, // Always use server timestamp for consistency
  } as SecretDetail;
}
