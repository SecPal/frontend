// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export const OFFLINE_SESSION_CACHE_NAME = "auth-session-state";
export const OFFLINE_SESSION_STATE_PATH = "/__session-state__";

export interface OfflineSessionState {
  isAuthenticated: boolean;
}

export interface AuthSessionChangedMessage {
  type: "AUTH_SESSION_CHANGED";
  isAuthenticated: boolean;
}

function canUseSessionCache(): boolean {
  return "caches" in globalThis && "location" in globalThis;
}

function getOfflineSessionStateUrl(): string {
  return new URL(
    OFFLINE_SESSION_STATE_PATH,
    globalThis.location.origin
  ).toString();
}

async function openOfflineSessionCache(): Promise<Cache | null> {
  if (!canUseSessionCache()) {
    return null;
  }

  return caches.open(OFFLINE_SESSION_CACHE_NAME);
}

export async function readOfflineSessionState(): Promise<OfflineSessionState | null> {
  const cache = await openOfflineSessionCache();

  if (!cache) {
    return null;
  }

  const response = await cache.match(getOfflineSessionStateUrl());

  if (!response) {
    return null;
  }

  try {
    const parsed: unknown = await response.json();

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).isAuthenticated !== "boolean"
    ) {
      await cache.delete(getOfflineSessionStateUrl());
      return null;
    }

    return {
      isAuthenticated: (parsed as Record<string, unknown>)
        .isAuthenticated as boolean,
    };
  } catch {
    await cache.delete(getOfflineSessionStateUrl());
    return null;
  }
}

export async function writeOfflineSessionState(
  isAuthenticated: boolean
): Promise<void> {
  const cache = await openOfflineSessionCache();

  if (!cache) {
    return;
  }

  // Logout policy: keep only the minimum boolean auth state required for the
  // service worker to gate offline navigation after logout.
  const state: OfflineSessionState = { isAuthenticated };

  await cache.put(
    getOfflineSessionStateUrl(),
    new Response(JSON.stringify(state), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    })
  );
}
