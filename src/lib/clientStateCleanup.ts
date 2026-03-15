// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";

export const SENSITIVE_CACHE_NAMES = [
  // Active caches
  "api-cache",
  "api-users",
  "api-general",
  // Legacy Secrets caches removed in v6 — kept here so existing users'
  // browsers clean up sensitive data on the next logout/clearState call.
  "secrets-list-cache",
  "secrets-detail-cache",
  "api-secrets-list",
  "api-secrets-detail",
] as const;

async function clearSensitiveCaches(): Promise<void> {
  if (!("caches" in globalThis)) {
    return;
  }

  const cacheNames = await caches.keys();
  const sensitiveCacheNames = cacheNames.filter((cacheName) =>
    SENSITIVE_CACHE_NAMES.includes(
      cacheName as (typeof SENSITIVE_CACHE_NAMES)[number]
    )
  );

  await Promise.all(
    sensitiveCacheNames.map((cacheName) => caches.delete(cacheName))
  );
}

async function clearSensitiveIndexedDbState(): Promise<void> {
  await Promise.all([
    db.guards.clear(),
    db.syncQueue.clear(),
    db.apiCache.clear(),
    db.analytics.clear(),
    db.organizationalUnitCache.clear(),
  ]);
}

export async function clearSensitiveClientState(): Promise<void> {
  localStorage.removeItem("auth_user");
  localStorage.removeItem("auth_token");
  sessionStorage.clear();

  await Promise.all([clearSensitiveCaches(), clearSensitiveIndexedDbState()]);
}
