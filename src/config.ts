// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Application Configuration
 *
 * This file contains configuration that can be overridden per deployment.
 * For customer-specific deployments, copy this file and adjust the values.
 */

/**
 * API Configuration
 */
export class ApiBaseUrlConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiBaseUrlConfigurationError";
  }
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeConfiguredApiBaseUrl(value: string): string {
  return stripTrailingSlashes(value.trim());
}

export function resolveApiBaseUrl(options?: {
  configuredBaseUrl?: string;
  mode?: string;
}): string {
  const configuredBaseUrl =
    options?.configuredBaseUrl ?? import.meta.env.VITE_API_URL ?? "";
  const mode = options?.mode ?? import.meta.env.MODE;
  const normalizedConfiguredBaseUrl =
    normalizeConfiguredApiBaseUrl(configuredBaseUrl);

  if (!normalizedConfiguredBaseUrl) {
    if (mode === "production") {
      throw new ApiBaseUrlConfigurationError(
        "VITE_API_URL must be set to an absolute https:// or http:// API origin in production. Relative or missing API base URLs are unsafe because they can route /v1/* and /sanctum/* back to the SPA host."
      );
    }

    return "";
  }

  if (mode !== "production") {
    return normalizedConfiguredBaseUrl;
  }

  if (!isAbsoluteHttpUrl(normalizedConfiguredBaseUrl)) {
    throw new ApiBaseUrlConfigurationError(
      "VITE_API_URL must be an absolute https:// or http:// API origin in production. Relative API base URLs are unsafe because they can route /v1/* and /sanctum/* back to the SPA host."
    );
  }

  return normalizedConfiguredBaseUrl;
}

export const apiConfig = {
  /**
   * Base URL for API requests (without /api prefix - backend routes are at /v1/*)
   * Can be overridden via VITE_API_URL environment variable.
   * Production builds require an absolute API base URL; missing or relative
   * values fail fast so `/v1/*` and `/sanctum/*` never fall back to the SPA
   * origin by accident.
   *
   * Examples:
   * - Development with DDEV: (empty string, Vite proxy handles routing)
   * - Development without proxy: http://localhost:8000
   * - Demo/Testing: https://api.secpal.dev
   * - Production: deployment-specific absolute API origin provided during deployment
   * - Customer On-Premise: customer-specific absolute API origin provided during deployment
   *
   * Note: The backend uses apiPrefix: '' in Laravel's bootstrap/app.php,
   * so routes are accessible at /v1/* NOT /api/v1/*
   *
   * Local Development:
   * When VITE_API_URL is not set, we use empty string for same-origin requests.
   * Vite's proxy (see vite.config.ts) forwards /v1/* and /sanctum/* to DDEV.
   */
  get baseUrl(): string {
    return resolveApiBaseUrl();
  },

  /**
   * API timeout in milliseconds
   */
  timeout: 10000,

  /**
   * Retry configuration for failed requests
   */
  retry: {
    maxAttempts: 5,
    backoffMultiplier: 2, // 1s, 2s, 4s, 8s, 16s
    maxRetentionTimeMinutes: 60 * 24, // 24 hours
  },
};

/**
 * Application Configuration
 */
export const appConfig = {
  /**
   * Application name
   */
  name: "SecPal",

  /**
   * Default locale
   */
  defaultLocale: "en",

  /**
   * Available locales
   */
  availableLocales: ["en", "de"],
};

/**
 * Get API base URL
 * Convenience function for accessing the configured API base URL
 */
export function getApiBaseUrl(): string {
  return apiConfig.baseUrl;
}

export function buildApiUrl(
  path: string,
  options?: {
    configuredBaseUrl?: string;
    mode?: string;
  }
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = resolveApiBaseUrl(options);

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
