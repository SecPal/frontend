// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import type { SecretCacheEntry } from "./db";

/**
 * Save a secret to IndexedDB cache
 *
 * @param secret - Secret to cache
 *
 * @example
 * ```ts
 * await saveSecret({
 *   id: 'secret-1',
 *   title: 'Gmail Account',
 *   username: 'user@example.com',
 *   created_at: new Date().toISOString(),
 *   updated_at: new Date().toISOString(),
 *   cachedAt: new Date(),
 *   lastSynced: new Date(),
 * });
 * ```
 */
export async function saveSecret(secret: SecretCacheEntry): Promise<void> {
  await db.secretCache.put(secret);
}

/**
 * Get a secret from IndexedDB cache by ID
 *
 * @param id - Secret ID
 * @returns Secret or undefined if not found
 *
 * @example
 * ```ts
 * const secret = await getSecret('secret-1');
 * if (secret) {
 *   console.log(secret.title);
 * }
 * ```
 */
export async function getSecret(
  id: string
): Promise<SecretCacheEntry | undefined> {
  return db.secretCache.get(id);
}

/**
 * List all cached secrets
 *
 * @returns Array of secrets sorted by updated_at (newest first)
 *
 * @example
 * ```ts
 * const secrets = await listSecrets();
 * console.log(`Cached ${secrets.length} secrets`);
 * ```
 */
export async function listSecrets(): Promise<SecretCacheEntry[]> {
  const secrets = await db.secretCache.toArray();

  // Sort by updated_at descending (newest first)
  return secrets.sort((a, b) => {
    const dateA = new Date(a.updated_at).getTime();
    const dateB = new Date(b.updated_at).getTime();
    return dateB - dateA;
  });
}

/**
 * Delete a secret from IndexedDB cache
 *
 * @param id - Secret ID to delete
 *
 * @example
 * ```ts
 * await deleteSecret('secret-1');
 * ```
 */
export async function deleteSecret(id: string): Promise<void> {
  await db.secretCache.delete(id);
}

/**
 * Search secrets by title, username, or notes (case-insensitive)
 *
 * @param query - Search query string
 * @returns Array of matching secrets
 *
 * @example
 * ```ts
 * const results = await searchSecrets('gmail');
 * console.log(`Found ${results.length} secrets`);
 * ```
 */
export async function searchSecrets(
  query: string
): Promise<SecretCacheEntry[]> {
  if (!query.trim()) {
    return listSecrets();
  }

  const lowerQuery = query.toLowerCase();
  const allSecrets = await db.secretCache.toArray();

  return allSecrets.filter((secret) => {
    const titleMatch = secret.title.toLowerCase().includes(lowerQuery);
    const usernameMatch = secret.username?.toLowerCase().includes(lowerQuery);
    const notesMatch = secret.notes?.toLowerCase().includes(lowerQuery);

    return titleMatch || usernameMatch || notesMatch;
  });
}

/**
 * Get secrets by tag
 *
 * @param tag - Tag to filter by
 * @returns Array of secrets with the specified tag
 *
 * @example
 * ```ts
 * const emailSecrets = await getSecretsByTag('email');
 * ```
 */
export async function getSecretsByTag(
  tag: string
): Promise<SecretCacheEntry[]> {
  const allSecrets = await db.secretCache.toArray();

  return allSecrets.filter(
    (secret) => secret.tags && secret.tags.includes(tag)
  );
}

/**
 * Get expired secrets
 *
 * @returns Array of secrets that have passed their expiration date
 *
 * @example
 * ```ts
 * const expired = await getExpiredSecrets();
 * for (const secret of expired) {
 *   console.log(`${secret.title} has expired`);
 * }
 * ```
 */
export async function getExpiredSecrets(): Promise<SecretCacheEntry[]> {
  const now = new Date();
  const allSecrets = await db.secretCache.toArray();

  return allSecrets.filter((secret) => {
    if (!secret.expires_at) return false;
    return new Date(secret.expires_at) < now;
  });
}

/**
 * Clear all secrets from IndexedDB cache
 *
 * Useful for logout or cache reset scenarios
 *
 * @example
 * ```ts
 * await clearSecretCache();
 * console.log('Secret cache cleared');
 * ```
 */
export async function clearSecretCache(): Promise<void> {
  await db.secretCache.clear();
}
