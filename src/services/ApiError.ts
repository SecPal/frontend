// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Custom error class for API-related errors
 */
export type ApiValidationErrors = Record<string, string[]>;

export class ApiError extends Error {
  public readonly status?: number;
  public readonly statusCode?: number;
  public readonly errors?: ApiValidationErrors;
  public readonly response?: Response;

  constructor(
    message: string,
    statusCode?: number,
    errorsOrResponse?: ApiValidationErrors | Response,
    response?: Response
  ) {
    super(message);
    this.name = "ApiError";

    this.status = statusCode;
    this.statusCode = statusCode;

    if (errorsOrResponse instanceof Response) {
      this.response = errorsOrResponse;
    } else {
      this.errors = errorsOrResponse;
      this.response = response;
    }

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
