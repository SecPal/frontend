// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getApiBaseUrl } from "../config";

/**
 * Health check status from the backend API
 */
export interface HealthStatus {
  /** Overall status: 'ready' (all checks passed) or 'not_ready' (some checks failed) */
  status: "ready" | "not_ready";
  /** Individual check results */
  checks: {
    /** Database connectivity status */
    database: "ok" | "error";
    /** Tenant encryption keys status */
    tenant_keys: "ok" | "missing" | "error";
    /** Key Encryption Key file status */
    kek_file: "ok" | "missing";
  };
  /** ISO 8601 timestamp of the health check */
  timestamp: string;
}

/**
 * Error thrown when health check fails
 */
export class HealthCheckError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "HealthCheckError";
  }
}

/**
 * Default timeout for health check requests in milliseconds.
 * Health checks should be fast - if they take too long, something is wrong.
 */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Check the backend API health status.
 *
 * Calls the /health/ready endpoint to verify all systems are operational:
 * - Database connectivity
 * - Tenant encryption keys present
 * - KEK file readable
 *
 * @returns Health status with individual check results
 * @throws {HealthCheckError} If the health check request fails (network error, timeout)
 *
 * @example
 * ```typescript
 * try {
 *   const health = await checkHealth();
 *   if (health.status === 'ready') {
 *     // All systems operational
 *   } else {
 *     // Some checks failed - see health.checks for details
 *   }
 * } catch (error) {
 *   // Network error or timeout - backend may be unreachable
 * }
 * ```
 */
export async function checkHealth(): Promise<HealthStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    HEALTH_CHECK_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${getApiBaseUrl()}/health/ready`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      credentials: "include",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Both 200 (ready) and 503 (not ready) are valid responses with JSON body
    if (response.ok || response.status === 503) {
      const data: HealthStatus = await response.json();
      return data;
    }

    // Unexpected status code
    throw new HealthCheckError(
      `Unexpected health check response: ${response.status}`,
      response.status
    );
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof HealthCheckError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new HealthCheckError("Health check timed out");
      }
      throw new HealthCheckError(`Health check failed: ${error.message}`);
    }

    throw new HealthCheckError("Health check failed: Unknown error");
  }
}
