// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { MacroMessageDescriptor } from "@lingui/core/macro";
import { describe, expect, it } from "vitest";

import { ApiError, type ApiValidationErrors } from "../services/ApiError";
import { AuthApiError } from "../services/AuthApiError";
import {
  getErrorRetryAfterSeconds,
  getErrorValidationErrors,
  getLocalizedErrorMessage,
} from "./errorUtils";

const descriptor = (message: string): MacroMessageDescriptor =>
  ({ id: message, message }) as MacroMessageDescriptor;

const translate = (message: { message?: string; id: string }): string =>
  message.message ?? message.id;

const localizedMessages = {
  fallback: descriptor("Fallback error"),
  authentication: descriptor("Authentication error"),
  authorization: descriptor("Authorization error"),
  validation: descriptor("Validation error"),
  rateLimit: descriptor("Rate limit error"),
  notFound: descriptor("Not found error"),
  conflict: descriptor("Conflict error"),
  server: descriptor("Server error"),
};

describe("getLocalizedErrorMessage", () => {
  it.each([
    { status: 401, expected: "Authentication error" },
    { status: 403, expected: "Authorization error" },
    { status: 404, expected: "Not found error" },
    { status: 409, expected: "Conflict error" },
    { status: 422, expected: "Validation error" },
    { status: 429, expected: "Rate limit error" },
    { status: 500, expected: "Server error" },
    { status: 503, expected: "Server error" },
  ])("localizes API status $status", ({ status, expected }) => {
    expect(
      getLocalizedErrorMessage(
        new ApiError("Request failed", status),
        translate,
        localizedMessages
      )
    ).toBe(expected);
  });

  it("reads statuses from AuthApiError and onboarding-style response errors", () => {
    const authError = new AuthApiError(
      "Too many login attempts",
      undefined,
      429
    );
    const responseError = { response: { status: 404 } };

    expect(
      getLocalizedErrorMessage(authError, translate, localizedMessages)
    ).toBe("Rate limit error");
    expect(
      getLocalizedErrorMessage(responseError, translate, localizedMessages)
    ).toBe("Not found error");
  });

  it.each([
    new ApiError("Bad request", 400),
    new ApiError("No status"),
    new Error("Network failed"),
    "unexpected failure",
  ])("uses the fallback when no status mapping matches", (error) => {
    expect(getLocalizedErrorMessage(error, translate, localizedMessages)).toBe(
      "Fallback error"
    );
  });

  it("uses default localized messages when optional overrides are omitted", () => {
    const baseOptions = { fallback: descriptor("Fallback error") };

    expect(
      getLocalizedErrorMessage(
        new ApiError("Unauthenticated", 401),
        translate,
        baseOptions
      )
    ).toBe(
      "Your session has expired or your sign-in could not be verified. Please sign in again."
    );
    expect(
      getLocalizedErrorMessage(
        new ApiError("Forbidden", 403),
        translate,
        baseOptions
      )
    ).toBe("You do not have permission to perform this action.");
    expect(
      getLocalizedErrorMessage(
        new ApiError("Missing", 404),
        translate,
        baseOptions
      )
    ).toBe("Fallback error");
    expect(
      getLocalizedErrorMessage(
        new ApiError("Conflict", 409),
        translate,
        baseOptions
      )
    ).toBe(
      "This action could not be completed because the data changed in the meantime. Please reload and try again."
    );
    expect(
      getLocalizedErrorMessage(
        new ApiError("Invalid", 422),
        translate,
        baseOptions
      )
    ).toBe("Please review the highlighted fields and try again.");
    expect(
      getLocalizedErrorMessage(
        new ApiError("Slow down", 429),
        translate,
        baseOptions
      )
    ).toBe("Too many requests. Please try again later.");
    expect(
      getLocalizedErrorMessage(
        new ApiError("Server failed", 500),
        translate,
        baseOptions
      )
    ).toBe(
      "A server error occurred. Please try again later or contact support if the problem persists."
    );
  });
});

describe("getErrorRetryAfterSeconds", () => {
  it("extracts retry-after seconds from AuthApiError", () => {
    const error = new AuthApiError(
      "Too many login attempts",
      undefined,
      429,
      undefined,
      30
    );

    expect(getErrorRetryAfterSeconds(error)).toBe(30);
  });

  it("extracts retry-after seconds from onboarding-style response errors", () => {
    const error = { response: { retryAfterSeconds: 45 } };

    expect(getErrorRetryAfterSeconds(error)).toBe(45);
  });

  it("returns undefined when retry-after seconds are not available", () => {
    expect(
      getErrorRetryAfterSeconds(new Error("Network failed"))
    ).toBeUndefined();
    expect(
      getErrorRetryAfterSeconds({ response: { retryAfterSeconds: "30" } })
    ).toBeUndefined();
  });
});

describe("getErrorValidationErrors", () => {
  it("extracts validation errors from ApiError", () => {
    const errors: ApiValidationErrors = {
      email: ["The email field is required."],
    };

    expect(
      getErrorValidationErrors(new ApiError("Validation failed", 422, errors))
    ).toEqual(errors);
  });

  it("extracts validation errors from onboarding-style response errors", () => {
    const errors: ApiValidationErrors = {
      password: ["The password must be at least 12 characters."],
    };

    expect(
      getErrorValidationErrors({
        response: {
          data: { errors },
        },
      })
    ).toEqual(errors);
  });

  it("returns undefined when validation errors are not available", () => {
    expect(
      getErrorValidationErrors(new Error("Network failed"))
    ).toBeUndefined();
    expect(
      getErrorValidationErrors({ response: { data: {} } })
    ).toBeUndefined();
  });
});
