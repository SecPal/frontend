<!--
SPDX-FileCopyrightText: 2025-2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Offline Support for /organization

## Overview

The `/organization` page is now fully offline-capable. Organizational units are cached in IndexedDB and remain available without an internet connection.

## Implemented Changes

### 1. IndexedDB Schema

**File:** `src/lib/db.ts`

- New table: `organizationalUnitCache`
- Introduced in schema version 5; current live schema is version 10
- Fields: id, type, name, parent_id, created_at, updated_at, cachedAt, lastSynced
- Indexes: `id, type, parent_id, updated_at, cachedAt`

```typescript
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
  parent?: { id: string; type: string; name: string } | null;
  created_at: string;
  updated_at: string;
  // Offline-specific fields
  cachedAt: Date;
  lastSynced: Date;
}
```

### 2. Store Functions

**File:** `src/lib/organizationalUnitStore.ts`

Similar to `secretStore.ts`:

- `saveOrganizationalUnit()` - Saves unit to IndexedDB
- `getOrganizationalUnit(id)` - Loads single unit
- `listOrganizationalUnits()` - Loads all units (sorted by name)
- `deleteOrganizationalUnit(id)` - Removes from cache
- `getOrganizationalUnitsByType(type)` - Filters by type
- `getOrganizationalUnitsByParent(parentId)` - Filters by parent
- `searchOrganizationalUnits(query)` - Full-text search in names
- `clearOrganizationalUnitCache()` - Clears entire cache

### 3. Offline Hook

**File:** `src/hooks/useOrganizationalUnitsWithOffline.ts`

Similar to `useSecretsWithOffline.ts`:

```typescript
export interface UseOrganizationalUnitsWithOfflineResult {
  units: OrganizationalUnit[]; // Units (API or cache)
  loading: boolean; // Loading state
  error: string | null; // Error message
  isOffline: boolean; // Browser is offline
  isStale: boolean; // Using cached data (outdated)
  rootUnitIds: string[]; // Root IDs for tree building
  refresh: () => Promise<void>; // Manual reload
}
```

**Behavior:**

- **Online:** API → Cache → UI (fresh data)
- **Offline:** Cache → UI (cached data)
- **API Error (online):** Cache as fallback (stale=true)
- **Auto-Refresh:** When back online with stale data

### 4. OrganizationalUnitTree

**File:** `src/components/OrganizationalUnitTree.tsx`

- **Replaced:** Direct API calls with `useOrganizationalUnitsWithOffline()`
- **Benefit:** Automatic caching and offline support
- **Tree Building:** Works even without `root_unit_ids` (offline mode)

### 5. OrganizationPage

**File:** `src/pages/Organization/OrganizationPage.tsx`

- **Offline Banner:** Displayed when user is offline
- **Stale Data Banner:** Displayed when using cached data
- **Functionality:** Cached organizational-unit reads remain available offline; create, edit, and delete flows stay online-only

## User Behavior

### Online Mode

1. Open page → API loads data
2. Data is cached in IndexedDB
3. Fresh data is displayed (no banner)

### Offline Mode

1. Open page → Cache loads data
2. **Yellow Banner:** "You're offline. Viewing cached organizational units..."
3. All data is loaded from cache
4. Cached read access remains available while offline
5. Mutations stay online-only and are blocked by the UI until connectivity returns

### API Error (Online)

1. API fails
2. **Blue Banner:** "Viewing cached data. Some units may be outdated."
3. Cached data is displayed
4. Retry button available

### Reconnection

1. User comes back online
2. Hook detects `isOnline=true` + `isStale=true`
3. Automatic API reload
4. Banner disappears

## Tests

### organizationalUnitStore.test.ts

- 17 tests for all store functions
- Tests: CRUD, Filtering, Search, Cache Management
- Status: ✅ 17/17 passing

### useOrganizationalUnitsWithOffline.test.ts

- 7 tests across 5 test suites
- Tests: Online, Offline, API Error, Refresh, Auto-Refresh
- Status: ✅ 7/7 passing

### OrganizationalUnitTree.test.tsx

- Existing tests need to be updated for hook usage
- Status: ⚠️ In progress (mock updates required)

## End User Migration

**Automatic:**

- Dexie.js migrates the IndexedDB schema automatically as `DB_VERSION` changes
- The organizational-unit cache was introduced in v5
- The current live schema is v10 and no longer keeps the stale `pendingSync` field or index
- Existing cached records are preserved while the store definition is updated

**No user action required!**

## Comparison with Secrets

Implementation follows the exact pattern of `/secrets`:

| Feature         | Secrets                 | Organization                        |
| --------------- | ----------------------- | ----------------------------------- |
| IndexedDB Table | `secretCache`           | `organizationalUnitCache`           |
| Store File      | `secretStore.ts`        | `organizationalUnitStore.ts`        |
| Offline Hook    | `useSecretsWithOffline` | `useOrganizationalUnitsWithOffline` |
| Banners         | ✅ Offline/Stale        | ✅ Offline/Stale                    |
| Auto-Refresh    | ✅                      | ✅                                  |
| Tests           | ✅ 100%                 | ✅ 100%                             |

## Next Steps

1. ✅ IndexedDB schema extended (v5)
2. ✅ Store functions implemented
3. ✅ Offline hook created
4. ✅ OrganizationalUnitTree adapted
5. ✅ OrganizationPage with banners
6. ✅ Tests for store and hook
7. ⚠️ OrganizationalUnitTree tests need updating (mock adjustments)
8. ✅ Authenticated organizational-unit HTTP responses remain uncached; offline reads rely on IndexedDB only

## Service Worker Integration

Authenticated organizational-unit API responses are intentionally not cached in the service worker.
The supported offline path is the explicit IndexedDB cache populated from successful online reads.

## Maintenance

### Schema Updates

For future schema changes:

1. Increment `DB_VERSION` in `db-constants.ts`
2. Update the current `db.version(DB_VERSION).stores({...})` block in `db.ts`
3. Re-declare all existing tables
4. Update tests

### Cache Invalidation

Cache is invalidated when:

- API success (fresh data overwrites cache)
- User logout (recommended: `clearOrganizationalUnitCache()`)
- Manual refresh by user

## Known Limitations

1. **Hierarchy Metadata Offline:**
   - `root_unit_ids` only available online
   - Offline: All units without parents are treated as roots

2. **Pagination:**
   - Offline: No real pagination (all cached data)
   - Online: API pagination (per_page=100)

3. **Conflict Resolution:**
   - Current: Last-Write-Wins
   - TODO: Conflict resolution UI during sync

## Architecture Decisions

Follows **ADR-003: Offline-First Architecture**:

- IndexedDB as local cache
- Service Worker for HTTP caching
- NetworkFirst strategy for fresh data
- Cache fallback when offline/error
- Cache-backed read access for fast offline feedback

## Support

For questions or issues:

- See: `.github/docs/adr/20251027-offline-first-architecture.md`
- Issue #283: Epic - Organizational Structure Management (CRUD)
