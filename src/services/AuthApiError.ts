// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export class AuthApiError extends Error {
  public errors?: Record<string, string[]>;
  public status?: number;
  public code?: string;
  public retryAfterSeconds?: number;

  constructor(
    message: string,
    errors?: Record<string, string[]>,
    status?: number,
    code?: string,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "AuthApiError";
    this.errors = errors;
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
