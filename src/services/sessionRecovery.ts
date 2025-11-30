// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";
import type { User } from "../contexts/auth-context";

/**
 * Custom error for session expiry
 */
export class SessionExpiredError extends Error {
  constructor(message = "Session has expired") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

/**
 * Check if the browser is online
 * Returns true if online or if we can't determine (SSR)
 */
function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Attempt to recover/validate the session by calling /me endpoint.
 *
 * Laravel's "remember me" cookie (if set during login) will automatically
 * restore the session even after the session has expired.
 *
 * For a PWA (offline-first):
 * - If online and session valid → returns user data
 * - If online and session invalid → returns null (should logout)
 * - If offline → returns null (use cached data, don't change auth state)
 *
 * @returns User data if session is valid, null otherwise
 */
export async function tryRecoverSession(): Promise<User | null> {
  // Don't attempt recovery when offline - use cached data
  if (!isOnline()) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/me`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return response.json();
    }

    // Session is truly invalid
    return null;
  } catch {
    // Network error - treat as offline, don't change auth state
    return null;
  }
}

/**
 * Callback type for session expiry notification
 */
export type OnSessionExpired = () => void;

/**
 * Creates a fetch wrapper that handles 401 responses by notifying
 * the application of session expiry.
 *
 * For a PWA (offline-first):
 * - If online and get 401 → session expired, notify app
 * - If offline and get 401 → might be cached response, don't trigger logout
 *
 * @param onSessionExpired Callback when session has definitely expired
 * @returns A fetch wrapper function
 */
export function createAuthAwareFetch(
  onSessionExpired: OnSessionExpired
): typeof fetch {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await fetch(input, init);

    // Handle 401 Unauthorized
    if (response.status === 401) {
      // Only trigger session expired when we're definitely online
      // When offline, 401 might come from a cached/stale response
      if (isOnline()) {
        onSessionExpired();
        throw new SessionExpiredError();
      }
      // When offline, return the response and let the app handle it
      // (probably show cached data or offline message)
    }

    return response;
  };
}
