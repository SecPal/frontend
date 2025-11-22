// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Format validation errors from API responses
 * @param err Error object that may contain validation errors
 * @returns Formatted error message or null
 */
export function formatValidationErrors(err: unknown): string | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    err.status === 422 &&
    "errors" in err
  ) {
    return Object.entries(err.errors as Record<string, string[]>)
      .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
      .join("; ");
  }
  return null;
}
