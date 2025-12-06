// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";
import type { OrganizationalUnitCacheEntry } from "./db";

/**
 * Save an organizational unit to IndexedDB cache
 *
 * @param unit - Organizational unit to cache
 *
 * @example
 * ```ts
 * await saveOrganizationalUnit({
 *   id: 'unit-1',
 *   type: 'branch',
 *   name: 'Berlin Branch',
 *   created_at: new Date().toISOString(),
 *   updated_at: new Date().toISOString(),
 *   cachedAt: new Date(),
 *   lastSynced: new Date(),
 * });
 * ```
 */
export async function saveOrganizationalUnit(
  unit: OrganizationalUnitCacheEntry
): Promise<void> {
  await db.organizationalUnitCache.put(unit);
}

/**
 * Get an organizational unit from IndexedDB cache by ID
 *
 * @param id - Organizational unit ID
 * @returns Organizational unit or undefined if not found
 *
 * @example
 * ```ts
 * const unit = await getOrganizationalUnit('unit-1');
 * if (unit) {
 *   console.log(unit.name);
 * }
 * ```
 */
export async function getOrganizationalUnit(
  id: string
): Promise<OrganizationalUnitCacheEntry | undefined> {
  return db.organizationalUnitCache.get(id);
}

/**
 * List all cached organizational units
 *
 * @returns Array of organizational units sorted by name (ascending)
 *
 * @example
 * ```ts
 * const units = await listOrganizationalUnits();
 * console.log(`Cached ${units.length} organizational units`);
 * ```
 */
export async function listOrganizationalUnits(): Promise<
  OrganizationalUnitCacheEntry[]
> {
  const units = await db.organizationalUnitCache.toArray();

  // Sort by name ascending
  return units.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Delete an organizational unit from IndexedDB cache
 *
 * @param id - Organizational unit ID to delete
 *
 * @example
 * ```ts
 * await deleteOrganizationalUnit('unit-1');
 * ```
 */
export async function deleteOrganizationalUnit(id: string): Promise<void> {
  await db.organizationalUnitCache.delete(id);
}

/**
 * Get organizational units by type
 *
 * @param type - Unit type to filter by
 * @returns Array of matching organizational units sorted by name
 *
 * @example
 * ```ts
 * const branches = await getOrganizationalUnitsByType('branch');
 * ```
 */
export async function getOrganizationalUnitsByType(
  type: OrganizationalUnitCacheEntry["type"]
): Promise<OrganizationalUnitCacheEntry[]> {
  const units = await db.organizationalUnitCache
    .where("type")
    .equals(type)
    .toArray();

  return units.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get organizational units by parent ID
 *
 * @param parentId - Parent unit ID to filter by (null for root units)
 * @returns Array of matching organizational units sorted by name
 *
 * @example
 * ```ts
 * const children = await getOrganizationalUnitsByParent('holding-1');
 * const rootUnits = await getOrganizationalUnitsByParent(null);
 * ```
 */
export async function getOrganizationalUnitsByParent(
  parentId: string | null
): Promise<OrganizationalUnitCacheEntry[]> {
  let units: OrganizationalUnitCacheEntry[];

  if (parentId === null) {
    // For root units, we need to filter where parent_id is null or undefined
    const allUnits = await db.organizationalUnitCache.toArray();
    units = allUnits.filter(
      (unit) => unit.parent_id === null || unit.parent_id === undefined
    );
  } else {
    units = await db.organizationalUnitCache
      .where("parent_id")
      .equals(parentId)
      .toArray();
  }

  return units.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Search organizational units by name
 *
 * @param query - Search query (case-insensitive)
 * @returns Array of matching organizational units sorted by name
 *
 * @example
 * ```ts
 * const results = await searchOrganizationalUnits('berlin');
 * ```
 */
export async function searchOrganizationalUnits(
  query: string
): Promise<OrganizationalUnitCacheEntry[]> {
  const lowerQuery = query.toLowerCase();
  const units = await db.organizationalUnitCache
    .filter((unit) => unit.name.toLowerCase().includes(lowerQuery))
    .toArray();

  return units.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Clear all cached organizational units
 *
 * @example
 * ```ts
 * await clearOrganizationalUnitCache();
 * ```
 */
export async function clearOrganizationalUnitCache(): Promise<void> {
  await db.organizationalUnitCache.clear();
}

/**
 * Get organizational units with pending sync
 *
 * @returns Array of organizational units that have local changes not yet synced
 *
 * @example
 * ```ts
 * const pendingUnits = await getPendingSyncUnits();
 * console.log(`${pendingUnits.length} units need to be synced`);
 * ```
 */
export async function getPendingSyncUnits(): Promise<
  OrganizationalUnitCacheEntry[]
> {
  // Filter units where pendingSync is explicitly true
  const allUnits = await db.organizationalUnitCache.toArray();
  const units = allUnits.filter((unit) => unit.pendingSync === true);

  return units.sort((a, b) => a.name.localeCompare(b.name));
}
