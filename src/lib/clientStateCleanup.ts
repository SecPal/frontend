// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { db } from "./db";

export const SENSITIVE_CACHE_NAMES = [
  "api-cache",
  "api-users",
  "api-general",
] as const;

const USER_SCOPED_LOCAL_STORAGE_KEYS = [
  "auth_user",
  "auth_token",
  "secpal-notification-preferences",
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
      db.analytics.clear(),
      db.organizationalUnitCache.clear(),
    ]);
  }
}

export async function clearSensitiveClientState(): Promise<void> {
  for (const key of USER_SCOPED_LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  sessionStorage.clear();

  await Promise.all([clearSensitiveCaches(), clearSensitiveIndexedDbState()]);
}
