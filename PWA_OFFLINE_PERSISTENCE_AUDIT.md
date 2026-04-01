<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# PWA / Offline / Client Persistence – Security & Privacy Audit

**Date:** 2026-03-31
**Scope:** `frontend/` repository – all client-side persistence mechanisms
**Method:** Static code analysis of all storage, cache, and service worker paths

---

## 0. Overlap with open issues

The following open issues cover parts of the audit scope:

| Issue | Title                                                                  | Overlapping findings                                       |
| ----- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| #493  | Security: harden frontend offline data caching and logout cleanup      | FINDING-02, -05, -06, -08 (Phase 1 scope: general cleanup) |
| #495  | Security: design encrypted offline vault with device-bound key options | FINDING-08 (Phase 2 scope: long-term PII at rest)          |
| #68   | Phase 4: Offline Data Management & Conflict Resolution                 | FINDING-03, -07 (sync queue, TTL, multi-tab)               |

See also `docs/OFFLINE_DATA_PROTECTION_ROADMAP.md` for the phased architecture.

**New findings (not covered by existing issues):**

- FINDING-01: `login_rate_limit` survives logout
- FINDING-04: `static-assets` cache in the service worker without expiration
- FINDING-06: `pwaRuntimeCaching.ts` expiration config is ineffective with `injectManifest` (more specific than #493)
- FINDING-09: `XSRF-TOKEN` cookie remains after logout (backend-side)
- FINDING-10: Push subscription potentially remains active after logout

**Confirmation of existing issues with additional detail:**

- FINDING-02 provides the concrete code finding for #493 (analytics `userId` without TTL/sync)
- FINDING-08 provides the concrete code finding for #493/#495 (PII fields in `localStorage`)

---

## 1. Inventory: Local persistence mechanisms

### 1.1 localStorage

| Key                               | Content                                                                                                                                                 | Sensitive?                 | Cleanup on logout?                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------- |
| `auth_user`                       | User object (id, name, email, roles, permissions, hasOrganizationalScopes, hasCustomerAccess, hasSiteAccess) — **no** employee field in persisted state | Medium (PII: name, e-mail) | **Yes** – `clearSensitiveClientState()`  |
| `auth_token`                      | Legacy field, actively removed in the `LocalStorageAuthStorage` constructor                                                                             | High (if present)          | **Yes** – both cleanup and legacy wipe   |
| `auth_logout_barrier`             | Flag ("1") for BFCache protection                                                                                                                       | No                         | No (intentional – deleted on next login) |
| `secpal-notification-preferences` | JSON with notification categories (alerts, updates, maintenance)                                                                                        | Low                        | **Yes**                                  |
| `secpal-locale`                   | Language preference (e.g. "de")                                                                                                                         | No                         | **No** (intentional – user-neutral)      |
| `login_rate_limit`                | Failsafe counter (attempts, lockoutEndTime, lastAttemptTime)                                                                                            | Low                        | **No**                                   |

### 1.2 sessionStorage

| Key                                | Content                                           | Cleanup on logout?                      |
| ---------------------------------- | ------------------------------------------------- | --------------------------------------- |
| `secpal-native-pwa-cleanup-reload` | Capacitor reload guard ("1")                      | **Yes** – full `sessionStorage.clear()` |
| (other)                            | No further explicit uses found in production code | **Yes** – full clear                    |

### 1.3 IndexedDB (`SecPalDB`, version 10)

| Store                     | Content                                                                                                       | Sensitive?                 | Cleanup on logout?                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| `analytics`               | Offline tracking events: type, category, action, label, value, metadata, sessionId, userId, timestamp, synced | Medium (userId referenced) | **Yes** – `db.delete()` or fallback `db.analytics.clear()` |
| `organizationalUnitCache` | Organizational units: id, type, name, parent, timestamps                                                      | Medium (company structure) | **Yes** – `db.delete()` or fallback clear                  |

### 1.4 Cache API

| Cache name              | Content                                         | Sensitive?       | Cleanup on logout?                                                          |
| ----------------------- | ----------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `auth-session-state`    | Minimal boolean: `{ isAuthenticated: boolean }` | No               | **Partial** – set to `isAuthenticated: false`, but cache is **not deleted** |
| `api-cache`             | API responses (per cleanup list)                | Potentially high | **Yes**                                                                     |
| `api-users`             | User API responses                              | High (PII)       | **Yes**                                                                     |
| `api-general`           | General API responses                           | Medium           | **Yes**                                                                     |
| `static-assets`         | JS, CSS, images, fonts (CacheFirst)             | No               | **No** (correct – no user data)                                             |
| `images`                | Images (CacheFirst, 100 entries, 30 days)       | No               | **No**                                                                      |
| `fonts`                 | Fonts (CacheFirst, 30 entries, 365 days)        | No               | **No**                                                                      |
| `google-fonts-cache`    | Google Fonts (CacheFirst, 10 entries, 365 days) | No               | **No**                                                                      |
| `workbox-precache-v2-*` | Precached build assets (from Vite PWA plugin)   | No               | **No**                                                                      |

### 1.5 Cookies (for completeness)

| Cookie                           | Management                    | Cleanup on logout?                                          |
| -------------------------------- | ----------------------------- | ----------------------------------------------------------- |
| Session cookie (Laravel Sanctum) | httpOnly, set by server       | State is invalidated server-side via `POST /v1/auth/logout` |
| `XSRF-TOKEN`                     | Set by server, read by client | Remains until expiry – no dedicated client-side cleanup     |

### 1.6 Service Worker state

- **Registration:** `injectManifest` strategy via `vite-plugin-pwa`
- **Precaching:** `self.__WB_MANIFEST` (build assets, injected)
- **Navigation fallback:** All non-API routes → `/index.html` with session gate
- **Auth state in SW:** Reads `auth-session-state` cache for offline routing
- **Message listener:** `AUTH_SESSION_CHANGED`, `SKIP_WAITING`
- **Push handler:** Receives push messages, validates origin, shows notifications

---

## 2. Findings

### FINDING-01: `login_rate_limit` is not deleted on logout

- **Severity:** Low
- **Type:** Plausible risk / best practice
- **Affected:** [src/hooks/useLoginRateLimiter.ts](src/hooks/useLoginRateLimiter.ts), [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts)
- **Description:** The `login_rate_limit` key is not listed in `USER_SCOPED_LOCAL_STORAGE_KEYS` and is therefore not deleted on logout. The key contains `attempts`, `lockoutEndTime`, and `lastAttemptTime`. Although not directly sensitive, it persists across user sessions. On a shared device, the next user sees the lockout state of the previous user.
- **Fix:** Add `login_rate_limit` to `USER_SCOPED_LOCAL_STORAGE_KEYS` or delete it separately in `clearSensitiveClientState()`. Alternatively: the 15-minute reset timer provides sufficient mitigation – but then document that this key is intentionally persistent.

### FINDING-02: Analytics events contain `userId` and accumulate without backend sync

- **Severity:** Medium
- **Type:** Confirmed finding / privacy (data minimization)
- **Affected:** [src/lib/analytics.ts](src/lib/analytics.ts), [src/lib/db.ts](src/lib/db.ts)
- **Description:** Analytics events in IndexedDB contain `userId` (plaintext user ID) and `sessionId`. Backend sync is **not implemented** (`TODO: Implement actual sync to backend endpoint` in [src/lib/analytics.ts](src/lib/analytics.ts#L371)). Events are only marked locally as "synced", but are **never actually sent and never deleted**. Events accumulate without limit (no `maxEntries` limit, no TTL). On logout they are deleted via `resetForLogout()` and `db.delete()` – but only when logout completes successfully.
- **Risk:** On unexpected session end (browser crash, tab kill, cookie expiry without active logout), userId-linked analytics events may persist indefinitely in IndexedDB.
- **Fix:**
  1. Introduce TTL/maxAge for analytics events (e.g. automatically delete events older than 7 days)
  2. Cap the maximum event count (e.g. 1000 events, then discard the oldest)
  3. Store userId as a hashed value if backend sync is not implemented soon
  4. Implement backend sync and delete events after successful sync

### FINDING-03: OrganizationalUnit cache contains company structure data without TTL

- **Severity:** Low to medium
- **Type:** Confirmed finding / data minimization
- **Affected:** [src/lib/db.ts](src/lib/db.ts), [src/hooks/useOrganizationalUnitsWithOffline.ts](src/hooks/useOrganizationalUnitsWithOffline.ts)
- **Description:** Organizational units (name, type, hierarchy) are cached in IndexedDB and include `cachedAt` and `lastSynced` timestamps, but there is **no automatic TTL/eviction mechanism**. On online refresh, `clearOrganizationalUnitCache()` is called before reloading – but if the user is only working offline, stale data persists indefinitely. Logout correctly clears the cache.
- **Risk:** Low in normal use. On a shared device with a failed logout, organizational structure data of another tenant could be visible.
- **Fix:** Add an optional TTL check when reading from the cache (e.g. mark data older than 24 hours as stale/unusable).

### FINDING-04: Precache and static asset caches survive logout (correct, but worth monitoring)

- **Severity:** Info
- **Type:** Best practice / observation
- **Affected:** [src/sw.ts](src/sw.ts), [src/lib/pwaRuntimeCaching.ts](src/lib/pwaRuntimeCaching.ts)
- **Description:** The caches `static-assets`, `images`, `fonts`, `google-fonts-cache`, and `workbox-precache-v2-*` are intentionally **not** deleted on logout. This is correct – they contain no user data. However, the `static-assets` cache has **no `maxEntries` or `maxAgeSeconds` limit** in the service worker itself (the limit only exists in `pwaRuntimeCaching.ts` for the Vite config, but the SW registers its own separate `CacheFirst` route without expiration).
- **Fix:** Add a Workbox `ExpirationPlugin` to the `static-assets` CacheFirst route in the service worker to prevent unbounded growth:

  ```typescript
  import { ExpirationPlugin } from "workbox-expiration";
  // In sw.ts CacheFirst:
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  });
  ```

### FINDING-05: `auth-session-state` cache is overwritten on logout, not deleted

- **Severity:** Low
- **Type:** Confirmed finding
- **Affected:** [src/lib/offlineSessionState.ts](src/lib/offlineSessionState.ts), [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts)
- **Description:** On logout, `writeOfflineSessionState(false)` is called, setting the value to `{ isAuthenticated: false }`. The `auth-session-state` cache is **not deleted** and is also **not listed in `SENSITIVE_CACHE_NAMES`**. The cache only contains a boolean and no PII – so the risk is minimal. However, the presence of the cache potentially signals that the app was used in this browser.
- **Fix:** Either add `auth-session-state` to the cleanup list or explicitly document why the cache persists (the SW needs it for post-logout routing).

### FINDING-06: Duplicate CacheFirst registration for static-assets

- **Severity:** Low
- **Type:** Confirmed finding / inconsistency
- **Affected:** [src/sw.ts](src/sw.ts#L106-L114), [src/lib/pwaRuntimeCaching.ts](src/lib/pwaRuntimeCaching.ts#L30-L39)
- **Description:** `sw.ts` registers an explicit `CacheFirst` route for `static-assets` (lines 106–114, without expiration). `pwaRuntimeCaching.ts` also defines a `static-assets` cache for JS/CSS (with expiration: 50 entries, 365 days). The Vite PWA config uses `buildPwaRuntimeCaching()`, but with the `injectManifest` strategy, runtime caching rules are **not automatically injected into the SW** – they must be imported manually in the SW. The cache rules with expiration defined in `pwaRuntimeCaching.ts` are therefore **not applied in the SW**.
- **Risk:** The expiration limits in `pwaRuntimeCaching.ts` are ineffective. The CacheFirst route in the SW has no size or time limit.
- **Fix:** Either import and apply the expiration plugins directly in `sw.ts`, or remove `pwaRuntimeCaching.ts` and keep all cache configuration centrally in `sw.ts`.

### FINDING-07: No multi-tab logout race condition protection for IndexedDB deletion

- **Severity:** Low
- **Type:** Plausible risk
- **Affected:** [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts), [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- **Description:** Cross-tab logout is detected via the `storage` event (localStorage change on `auth_user`). Tab B detects the logout from Tab A and calls `clearAuthenticatedState(true)`, triggering `clearSensitiveClientState()`. If Tab A **simultaneously** runs `db.delete()` and Tab B also attempts `db.delete()`, a race condition can occur. The fallback (`db.analytics.clear()` + `db.organizationalUnitCache.clear()`) handles this.
- **Assessment:** The existing fallback mechanism is an adequate mitigation. The race condition does not cause data loss or state corruption, at most a log warning.
- **Fix:** No immediate fix needed. The fallback works. For a more robust solution: share `isClearingSessionRef` via BroadcastChannel so only one tab performs the deletion.

### FINDING-08: `auth_user` in localStorage contains e-mail and name (PII)

- **Severity:** Medium
- **Type:** Confirmed finding / privacy
- **Affected:** [src/services/storage.ts](src/services/storage.ts), [src/services/authState.ts](src/services/authState.ts)
- **Description:** The persisted `auth_user` record contains: `id`, `name`, `email`, `roles`, `permissions`, access flags. The `employee` field is correctly **not persisted** via `sanitizePersistedAuthUser()`. Data is deleted on successful logout.
- **Risk:** On a shared device (e.g. kiosk, shared workstation) without a proper logout, name and e-mail remain in localStorage. This is inherent to SPAs with offline support and cannot be fully avoided without giving up offline capability.
- **Existing mitigations:**
  - Logout barrier prevents BFCache restoration
  - Session-expired event triggers auto-logout on 401
  - Cross-tab sync clears other tabs on logout in any one tab
- **Fix:** Consider whether `name` and `email` are actually needed in localStorage or whether an opaque identifier suffices, with display data held only in React state (after server revalidation). Trade-off: offline display of the username would not be possible.

### FINDING-09: `XSRF-TOKEN` cookie remains after logout

- **Severity:** Low
- **Type:** Confirmed finding
- **Affected:** [src/services/csrf.ts](src/services/csrf.ts)
- **Description:** The `XSRF-TOKEN` cookie is set by the server and only read client-side. It is not explicitly deleted on logout. After server-side session invalidation the token is worthless, but it remains in the browser until the cookie expires.
- **Fix:** No urgent fix needed – the token serves no purpose after logout. For defense in depth: the server could explicitly delete the cookie in the logout response (`Set-Cookie: XSRF-TOKEN=; Max-Age=0`).

### FINDING-10: Push notification subscription may persist after logout

- **Severity:** Low to medium
- **Type:** Plausible risk
- **Affected:** [src/hooks/usePushSubscription.ts](src/hooks/usePushSubscription.ts)
- **Description:** Push subscriptions are registered with the browser via the Web Push API. On logout, `secpal-notification-preferences` are deleted from localStorage and the backend is notified (`POST /v1/auth/logout`). Whether the backend removes the push subscription (VAPID endpoint) on logout could not be verified from the frontend code. If the subscription persists server-side, push messages could be delivered to the device after logout.
- **Fix:** In the logout flow, before calling `POST /v1/auth/logout`, explicitly call `PushManager.getSubscription()`, call `.unsubscribe()`, and deregister the endpoint server-side. Alternatively: confirm whether the backend automatically removes all push subscriptions for the session on logout.

---

## 3. Architecture assessment

### Strengths

1. **No auth token in the client:** Authentication uses httpOnly cookies (Sanctum SPA mode). No token storage in localStorage or JS-accessible storage. Legacy token cleanup is proactively implemented.

2. **Clean logout flow:** The chain `authStorage.clear()` → `clearSensitiveClientState()` → `syncOfflineSessionAccess(false)` → `resetAnalyticsState()` is complete and covers localStorage, sessionStorage, IndexedDB, and sensitive Cache API caches.

3. **SW-based post-logout protection:** The service worker checks the `auth-session-state` cache on every navigation and redirects to `/login` when `isAuthenticated === false`. This prevents cached protected pages from being shown offline after logout.

4. **Cross-tab synchronization:** Logout in one tab propagates via the `storage` event and SW messaging to all other tabs and the service worker.

5. **BFCache protection:** The logout barrier in localStorage with a `pageshow` event handler prevents bfcache-restored pages from showing an authenticated view.

6. **Sanitization on persistence:** `sanitizePersistedAuthUser()` removes the `employee` field before saving to localStorage. Input validation on parse.

7. **CSP headers:** Strict Content-Security-Policy with `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.

8. **Capacitor cleanup:** The native runtime detects Capacitor and deregisters all service workers and deletes all caches.

### Areas for improvement

1. **Analytics without backend:** Events are collected but never sent. The local "synced" flag falsely suggests a completed sync. Events accumulate without limit.

2. **`pwaRuntimeCaching.ts` is ineffective:** The expiration configuration is not automatically applied in the `injectManifest` strategy. The real cache configuration in the SW has no limits.

3. **No storage quota monitoring:** `useCache.getCacheSize()` exists but is not used proactively to protect against quota exhaustion.

---

## 4. Summary risk matrix

| #   | Finding                                    | Severity   | Type                | Immediate action?        |
| --- | ------------------------------------------ | ---------- | ------------------- | ------------------------ |
| 01  | `login_rate_limit` survives logout         | Low        | Best practice       | Optional                 |
| 02  | Analytics with userId, no sync, no TTL     | Medium     | Privacy / data min. | **Yes** – TTL + limit    |
| 03  | OrgUnit cache without TTL                  | Low–medium | Data minimization   | Optional                 |
| 04  | `static-assets` cache without limit in SW  | Info       | Best practice       | Low                      |
| 05  | `auth-session-state` not deleted on logout | Low        | Completeness        | Document                 |
| 06  | Duplicate/ineffective cache config         | Low        | Inconsistency       | **Yes** – clean up       |
| 07  | Multi-tab logout race (IndexedDB)          | Low        | Edge case           | No (fallback sufficient) |
| 08  | PII (name, e-mail) in localStorage         | Medium     | Privacy             | Consider trade-off       |
| 09  | XSRF-TOKEN after logout                    | Low        | Completeness        | Optional (backend)       |
| 10  | Push subscription after logout             | Low–medium | Privacy             | **Verify** (backend)     |

---

## 5. Recommendations (priority)

### High (new findings – issue creation recommended)

1. **Implement analytics TTL + limit** (FINDING-02): Cap maximum event count (e.g. 1000) and maximum age (e.g. 7 days). Automatically delete old events on each track call. → Supplement to #493.

2. **Clean up `pwaRuntimeCaching.ts`** (FINDING-06): Either import Workbox expiration plugins directly in `sw.ts`, or remove the file and clarify that cache configuration lives in the SW file. → Separate issue recommended.

### Medium

1. **Verify push subscription on logout** (FINDING-10): Confirm that the backend removes push subscriptions on logout/session invalidation. → Separate issue recommended (cross-repo: frontend + API).

2. **Delete `login_rate_limit` on logout** (FINDING-01): Add to `USER_SCOPED_LOCAL_STORAGE_KEYS`. → Separate issue recommended.

### Low

1. **Add ExpirationPlugin to `static-assets` in SW** (FINDING-04): Prevents unbounded cache growth. → Supplement to existing cache cleanup under #493.

2. **OrgUnit cache TTL** (FINDING-03): Optional – mark data older than 24h as invalid when reading. → Fits into #68 (Phase 4).

3. **Delete XSRF-TOKEN server-side on logout** (FINDING-09): Server-side fix in the API. → Separate issue in the API repo recommended.
