// SPDX-FileCopyrightText: 2025 SecPal
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
export const apiConfig = {
  /**
   * Base URL for API requests (without /api prefix - backend routes are at /v1/*)
   * Can be overridden via VITE_API_URL environment variable
   *
   * Examples:
   * - Development: http://localhost:8000
   * - Demo/Testing: https://api.secpal.dev
   * - Production: https://api.secpal.app
   * - Customer On-Premise: https://api.customer.example.com
   *
   * Note: The backend uses apiPrefix: '' in Laravel's bootstrap/app.php,
   * so routes are accessible at /v1/secrets NOT /api/v1/secrets
   */
  baseUrl:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.MODE === "production"
      ? "https://api.secpal.app"
      : "http://localhost:8000"),

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
