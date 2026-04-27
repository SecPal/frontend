// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { OrganizationalUnitCacheEntry } from "./db";
import type { OrganizationalUnit } from "../types/organizational";
import {
  clearVaultOrganizationalUnits,
  deleteVaultOrganizationalUnit,
  getVaultOrganizationalUnit,
  listVaultOrganizationalUnits,
  saveVaultOrganizationalUnit,
} from "./offlineVault";

export function buildOrganizationalUnitCacheEntry(
  unit: OrganizationalUnit,
  syncedAt: Date = new Date()
): OrganizationalUnitCacheEntry {
  return {
    id: unit.id,
    type: unit.type,
    name: unit.name,
    custom_type_name: unit.custom_type_name ?? undefined,
    parent_id: unit.parent?.id ?? null,
    parent: unit.parent
      ? {
          id: unit.parent.id,
          type: unit.parent.type,
          name: unit.parent.name,
        }
      : null,
    created_at: unit.created_at,
    updated_at: unit.updated_at,
    cachedAt: syncedAt,
    lastSynced: syncedAt,
  };
}

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
  await saveVaultOrganizationalUnit(unit);
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
  return await getVaultOrganizationalUnit(id);
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
  const units = await listVaultOrganizationalUnits();

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
  await deleteVaultOrganizationalUnit(id);
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
  const units = (await listVaultOrganizationalUnits()).filter(
    (unit) => unit.type === type
  );

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
  const allUnits = await listVaultOrganizationalUnits();
  const units =
    parentId === null
      ? allUnits.filter(
          (unit) => unit.parent_id === null || unit.parent_id === undefined
        )
      : allUnits.filter((unit) => unit.parent_id === parentId);

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
  const units = (await listVaultOrganizationalUnits()).filter((unit) =>
    unit.name.toLowerCase().includes(lowerQuery)
  );

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
  await clearVaultOrganizationalUnits();
}
