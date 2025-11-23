// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";

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
 * This must be called before making any state-changing requests (POST, PUT, PATCH, DELETE)
 * Laravel will set the XSRF-TOKEN cookie which will be automatically sent with subsequent requests
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
    const [name, value] = cookie.trim().split("=");
    if (name === "XSRF-TOKEN" && value) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

/**
 * Fetch with CSRF token handling
 * Automatically includes X-XSRF-TOKEN header and retries on 419 (CSRF token mismatch)
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Response
 * @throws {CsrfError} If CSRF token refresh fails
 */
export async function fetchWithCsrf(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = getCsrfTokenFromCookie();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (csrfToken) {
    headers["X-XSRF-TOKEN"] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  // Retry on CSRF token mismatch
  if (response.status === 419) {
    await fetchCsrfToken();

    const newCsrfToken = getCsrfTokenFromCookie();
    const newHeaders: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (newCsrfToken) {
      newHeaders["X-XSRF-TOKEN"] = newCsrfToken;
    }

    return fetch(url, {
      ...options,
      credentials: "include",
      headers: newHeaders,
    });
  }

  return response;
}
