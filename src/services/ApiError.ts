// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Custom error class for API-related errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: Response
  ) {
    super(message);
    this.name = "ApiError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if this is a validation error (422)
   */
  isValidationError(): boolean {
    return this.statusCode === 422;
  }

  /**
   * Check if this is a not found error (404)
   */
  isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if this is an authentication error (401)
   */
  isAuthenticationError(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Check if this is an authorization error (403)
   */
  isAuthorizationError(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Check if this is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode ? this.statusCode >= 500 : false;
  }
}
