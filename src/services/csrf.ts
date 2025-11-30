// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";
import { sessionEvents, isOnline } from "./sessionEvents";

/**
 * Custom error class for CSRF-related errors
 */
export class CsrfError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "CsrfError";
  }
}

/**
 * Fetch CSRF token from Laravel Sanctum
 * This should be called before making state-changing requests (POST, PUT, PATCH, DELETE).
 * Laravel will set the XSRF-TOKEN cookie which will be automatically included by fetchWithCsrf.
 *
 * Note: Safe methods (GET, HEAD, OPTIONS) don't require CSRF protection.
 *
 * @throws {CsrfError} If CSRF token fetch fails
 */
export async function fetchCsrfToken(): Promise<void> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/sanctum/csrf-cookie`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new CsrfError("Failed to fetch CSRF token", response.status);
    }
  } catch (error) {
    if (error instanceof CsrfError) {
      throw error;
    }
    throw new CsrfError("Failed to fetch CSRF token");
  }
}

/**
 * Get CSRF token from XSRF-TOKEN cookie
 * Laravel sets this cookie when calling /sanctum/csrf-cookie
 *
 * @returns CSRF token or null if not found
 */
export function getCsrfTokenFromCookie(): string | null {
  const cookies = document.cookie.split(";");

  for (const cookie of cookies) {
    const trimmed = cookie.trim();
    if (trimmed.startsWith("XSRF-TOKEN=")) {
      const value = trimmed.substring("XSRF-TOKEN=".length);
      if (!value) {
        return null;
      }

      try {
        const decoded = decodeURIComponent(value);
        // Basic validation: tokens should be alphanumeric with possible special chars (Base64/URL-safe)
        if (decoded && /^[A-Za-z0-9+/=_-]+$/.test(decoded)) {
          return decoded;
        }
      } catch {
        // decodeURIComponent throws URIError for malformed sequences
        return null;
      }
    }
  }

  return null;
}

/**
 * HTTP methods that require CSRF protection
 */
const CSRF_REQUIRED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

/**
 * Central API fetch wrapper with automatic session handling.
 *
 * Features:
 * - Automatically includes `credentials: "include"` for cookie-based auth
 * - Adds X-XSRF-TOKEN header for state-changing methods (POST, PUT, PATCH, DELETE)
 * - Emits `session:expired` event on 401 responses (when online) for auto-logout
 * - Retries on 419 (CSRF token mismatch) with refreshed token
 *
 * For PWA offline-first behavior:
 * - 401 when online → session expired, emit event → auto-logout
 * - 401 when offline → might be from stale cache, don't trigger logout
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Response
 * @throws {CsrfError} If CSRF token refresh fails after 419
 *
 * @example
 * ```ts
 * // GET request (no CSRF token needed)
 * const response = await apiFetch(`${apiConfig.baseUrl}/v1/secrets`);
 *
 * // POST request (CSRF token added automatically)
 * const response = await apiFetch(`${apiConfig.baseUrl}/v1/secrets`, {
 *   method: "POST",
 *   headers: { "Content-Type": "application/json" },
 *   body: JSON.stringify(data),
 * });
 * ```
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  const needsCsrf = CSRF_REQUIRED_METHODS.includes(method);

  const headers = new Headers(options.headers);

  // Only add CSRF token for state-changing methods
  if (needsCsrf) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      headers.set("X-XSRF-TOKEN", csrfToken);
    }
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  // Handle session expiry (401 Unauthorized)
  // Only emit when online - offline 401s might be from stale cache
  if (response.status === 401 && isOnline()) {
    sessionEvents.emit("session:expired");
  }

  // Retry on CSRF token mismatch (only for methods that send CSRF)
  if (response.status === 419 && needsCsrf) {
    try {
      await fetchCsrfToken();
    } catch (error) {
      if (error instanceof CsrfError) {
        throw new CsrfError(
          `Failed to refresh CSRF token after 419 response: ${error.message}`,
          error.status
        );
      }
      throw error;
    }

    // Retry with refreshed token
    const newCsrfToken = getCsrfTokenFromCookie();
    const newHeaders = new Headers(options.headers);
    if (newCsrfToken) {
      newHeaders.set("X-XSRF-TOKEN", newCsrfToken);
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      headers: newHeaders,
    });
  }

  return response;
}

/**
 * @deprecated Use `apiFetch()` instead. This alias is kept for backward compatibility.
 *
 * Fetch with CSRF token handling (legacy name).
 * Now delegates to `apiFetch()` which handles both GET and state-changing methods.
 */
export const fetchWithCsrf = apiFetch;
