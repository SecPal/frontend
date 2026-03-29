// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";

export const SENSITIVE_CACHE_NAMES = [
  "api-cache",
  "api-users",
  "api-general",
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
  try {
    // Logout policy: remove the entire local session database because all
    // stores in SecPalDB are session- or user-adjacent and unnecessary once
    // the authenticated client state is cleared.
    await db.delete();
  } catch (error) {
    console.warn(
      "Failed to delete SecPalDB during logout, falling back to table clearing:",
      error
    );

    await Promise.all([
      db.guards.clear(),
      db.syncQueue.clear(),
      db.apiCache.clear(),
      db.analytics.clear(),
      db.organizationalUnitCache.clear(),
    ]);
  }
}

export async function clearSensitiveClientState(): Promise<void> {
  localStorage.removeItem("auth_user");
  localStorage.removeItem("auth_token");
  sessionStorage.clear();

  await Promise.all([clearSensitiveCaches(), clearSensitiveIndexedDbState()]);
}
